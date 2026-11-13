import os

# Before importing the app: test database and test environment.
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_DB"] = os.environ.get("POSTGRES_DB_TEST", "pricescope_test")

from collections.abc import AsyncIterator, Iterator  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402, F401
from app.api.deps import get_queue  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app as application  # noqa: E402
from app.models import Role, User, UserStatus  # noqa: E402

PASSWORD = "Prueba123"


class FakeQueue:
    """Replaces Redis/ARQ: keeps the jobs in a list so they can be inspected."""

    def __init__(self) -> None:
        self.jobs: list[tuple[str, tuple]] = []

    async def enqueue_job(self, function: str, *args: object, **kwargs: object) -> None:
        self.jobs.append((function, args))


@pytest.fixture(autouse=True)
async def clean_database() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        # Created by a migration in real databases (curation suggestions use it).
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture
def queue() -> Iterator[FakeQueue]:
    fake = FakeQueue()
    application.dependency_overrides[get_queue] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


@pytest.fixture
async def client(queue: FakeQueue) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as c:
        yield c


async def create_active_user(email: str, role: Role = Role.CLIENT) -> User:
    async with SessionLocal() as db:
        user = User(
            name="Usuario de prueba",
            company="Empresa de prueba",
            email=email,
            password_hash=hash_password(PASSWORD),
            role=role,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.commit()
        return user


async def login(client: AsyncClient, email: str, password: str = PASSWORD) -> str:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_token(client: AsyncClient) -> str:
    await create_active_user("admin@example.com", Role.ADMIN)
    return await login(client, "admin@example.com")


@pytest.fixture
async def client_token(client: AsyncClient) -> str:
    await create_active_user("cliente@example.com")
    return await login(client, "cliente@example.com")
