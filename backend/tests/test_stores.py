from httpx import AsyncClient

from app.core.database import SessionLocal
from app.models import Store, StoreCategory, UserStore
from tests.conftest import bearer, create_active_user, login

URL = "/api/v1/stores"


async def add_stores() -> dict[str, Store]:
    async with SessionLocal() as db:
        stores = {
            slug: Store(
                name=name,
                slug=slug,
                base_url=f"https://{slug}.example.com",
                category=StoreCategory.SUPERMARKET,
                scraper_key=slug,
                active=active,
            )
            for slug, name, active in [
                ("jumbo", "Jumbo", True),
                ("carrefour", "Carrefour", True),
                ("cerrada", "Cerrada", False),
            ]
        }
        db.add_all(stores.values())
        await db.commit()
        return stores


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401


async def test_client_sees_only_assigned_active_stores(client: AsyncClient) -> None:
    stores = await add_stores()
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        db.add_all(
            [UserStore(user_id=user.id, store_id=stores[s].id) for s in ("jumbo", "cerrada")]
        )
        await db.commit()
    token = await login(client, "cliente@example.com")

    response = await client.get(URL, headers=bearer(token))

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(stores["jumbo"].id),
            "name": "Jumbo",
            "slug": "jumbo",
            "category": "supermarket",
        }
    ]


async def test_client_without_stores_gets_empty_list(
    client: AsyncClient, client_token: str
) -> None:
    await add_stores()
    response = await client.get(URL, headers=bearer(client_token))
    assert response.json() == []


async def test_admin_sees_all_active_stores_sorted(client: AsyncClient, admin_token: str) -> None:
    await add_stores()
    response = await client.get(URL, headers=bearer(admin_token))
    assert [store["slug"] for store in response.json()] == ["carrefour", "jumbo"]
