from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import ExchangeRate, RateType, ScrapingRun, Store, StoreCategory
from app.services import operation
from app.workers import tasks
from tests.conftest import FakeQueue, bearer

URL = "/api/v1/admin/scraping"
NOW = datetime.now(UTC)


def store(slug: str) -> Store:
    return Store(
        name=slug.title(),
        slug=slug,
        base_url=f"https://www.{slug}.com.ar",
        category=StoreCategory.SUPERMARKET,
        scraper_key=slug,
    )


def run(
    store: Store, hours_ago: float, status: str = "success", saved: int = 0, **extra
) -> ScrapingRun:
    started = NOW - timedelta(hours=hours_ago)
    return ScrapingRun(
        store_id=store.id,
        status=status,
        search_mode="term",
        search_value="leche",
        started_at=started,
        finished_at=None if status == "running" else started + timedelta(seconds=90),
        products_received=saved,
        observations_saved=saved,
        **extra,
    )


@pytest.fixture
async def stores() -> dict[str, Store]:
    """Carrefour: ok every day, last one with 120. Jumbo: 403 now, after a 5xx fixed by a retry."""
    async with SessionLocal() as db:
        carrefour, jumbo = store("carrefour"), store("jumbo")
        db.add_all([carrefour, jumbo])
        await db.flush()
        db.add_all(
            [run(carrefour, 24 * days + 1, saved=100) for days in range(1, 9)]
            + [
                run(carrefour, 1, saved=120),
                run(
                    jumbo,
                    50,
                    "failed",
                    error_code="VTEX_FETCH_ERROR",
                    error_message="Unexpected VTEX HTTP status: 503",
                ),
                run(jumbo, 49, saved=80),
                run(
                    jumbo,
                    2,
                    "failed",
                    error_code="VTEX_FETCH_ERROR",
                    error_message="Unexpected VTEX HTTP status: 403",
                ),
                ExchangeRate(
                    source="test",
                    type=RateType.BLUE,
                    quoted_at=NOW - timedelta(minutes=30),
                    sell=1000,
                ),
            ]
        )
        await db.commit()
        return {"carrefour": carrefour, "jumbo": jumbo}


async def test_requires_admin(client: AsyncClient, client_token: str) -> None:
    assert (await client.get(f"{URL}/overview")).status_code == 401
    assert (await client.get(f"{URL}/overview", headers=bearer(client_token))).status_code == 403
    assert (await client.get(f"{URL}/errors", headers=bearer(client_token))).status_code == 403
    response = await client.post(f"{URL}/stores/carrefour/enqueue", headers=bearer(client_token))
    assert response.status_code == 403


async def test_overview(client: AsyncClient, admin_token: str, stores: dict) -> None:
    response = await client.get(f"{URL}/overview", headers=bearer(admin_token))
    assert response.status_code == 200, response.text
    body = response.json()
    cards = {card["store_slug"]: card for card in body["stores"]}

    carrefour = cards["carrefour"]
    assert carrefour["schedule"] == "Diario 06:00"
    assert carrefour["last_run"]["status"] == "success"
    assert carrefour["last_run"]["observations_saved"] == 120
    assert carrefour["expected"] == 100  # median of the last 7: six 100 and one 120
    assert len(carrefour["trend_7d"]) == 7
    assert carrefour["trend_7d"][-1]["products"] == 120  # best run of the day, not the sum
    assert carrefour["next_run_at"] > NOW.isoformat()[:10]
    assert carrefour["can_enqueue"] is False  # scraping disabled in tests

    jumbo = cards["jumbo"]
    assert jumbo["schedule"] == "Diario 06:30"
    assert jumbo["last_run"]["status"] == "failed"
    assert jumbo["last_run"]["error_code"] == "VTEX_FETCH_ERROR"
    assert jumbo["expected"] == 80
    assert jumbo["last_success_at"] is not None

    assert body["rates"]["ok"] is True
    assert body["rates"]["source"] == "test"
    assert body["rates"]["ingestions_24h"] == 1


async def test_rates_are_stale_after_two_hours(client: AsyncClient, admin_token: str) -> None:
    async with SessionLocal() as db:
        db.add(
            ExchangeRate(
                source="test", type=RateType.BLUE, quoted_at=NOW - timedelta(hours=3), sell=1000
            )
        )
        await db.commit()
    body = (await client.get(f"{URL}/overview", headers=bearer(admin_token))).json()
    assert body["stores"] == []
    assert body["rates"]["ok"] is False
    assert body["rates"]["ingestions_24h"] == 1  # 3 h ago: stale, but within the last 24 h


async def test_error_log(client: AsyncClient, admin_token: str, stores: dict) -> None:
    response = await client.get(f"{URL}/errors", params={"hours": 72}, headers=bearer(admin_token))
    assert response.status_code == 200, response.text
    entries = response.json()
    assert [(e["kind"], e["severity"]) for e in entries] == [
        ("block", "error"),  # the latest, nothing fixed it yet
        ("server", "warning"),  # a retry an hour later succeeded
    ]
    assert entries[0]["store_name"] == "Jumbo"
    assert entries[0]["message"] == "La tienda rechazó la consulta (HTTP 403)."
    assert "VTEX_FETCH_ERROR: Unexpected VTEX HTTP status: 403" in entries[0]["detail"]
    assert "resuelto" in entries[1]["detail"]


@pytest.mark.parametrize(
    ("params", "count"),
    [
        ({"hours": 24}, 1),
        ({"hours": 72, "kind": "server"}, 1),
        ({"hours": 72, "store": "carrefour"}, 0),
    ],
)
async def test_error_log_filters(
    client: AsyncClient, admin_token: str, stores: dict, params: dict, count: int
) -> None:
    response = await client.get(f"{URL}/errors", params=params, headers=bearer(admin_token))
    assert len(response.json()) == count


async def test_error_log_rejects_other_periods(client: AsyncClient, admin_token: str) -> None:
    response = await client.get(f"{URL}/errors?hours=12", headers=bearer(admin_token))
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("code", "message", "kind"),
    [
        ("RUN_INTERRUPTED", "Stale", "interrupted"),
        ("VTEX_FETCH_ERROR", "Unexpected VTEX HTTP status: 429", "block"),
        ("VTEX_FETCH_ERROR", "Network error: ReadTimeout", "timeout"),
        ("VTEX_FETCH_ERROR", "Network error: ConnectError", "network"),
        ("VTEX_FETCH_ERROR", "VTEX returned invalid JSON", "markup"),
        ("SCRAPING_ERROR", "KeyError", "other"),
    ],
)
def test_classify(code: str, message: str, kind: str) -> None:
    assert operation.classify(code, message)[0] == kind


@pytest.fixture
def jobs_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "scraping_enabled", True)
    monkeypatch.setattr(settings, "scraping_jobs_enabled", True)
    monkeypatch.setattr(settings, "scraping_allowed_stores", ["carrefour", "jumbo"])


async def test_enqueue_queues_the_daily_job(
    client: AsyncClient, admin_token: str, stores: dict, jobs_enabled: None, queue: FakeQueue
) -> None:
    response = await client.post(f"{URL}/stores/jumbo/enqueue", headers=bearer(admin_token))
    assert response.status_code == 202, response.text
    assert response.json()["store_slug"] == "jumbo"
    assert queue.jobs == [("scrape_jumbo", ())]


async def test_enqueue_refuses_a_store_already_running(
    client: AsyncClient, admin_token: str, stores: dict, jobs_enabled: None, queue: FakeQueue
) -> None:
    async with SessionLocal() as db:
        db.add(run(stores["carrefour"], 0.1, "running"))
        await db.commit()
    response = await client.post(f"{URL}/stores/carrefour/enqueue", headers=bearer(admin_token))
    assert response.status_code == 409
    assert queue.jobs == []


async def test_enqueue_requires_scheduled_scraping(
    client: AsyncClient, admin_token: str, stores: dict, queue: FakeQueue
) -> None:
    response = await client.post(f"{URL}/stores/carrefour/enqueue", headers=bearer(admin_token))
    assert response.status_code == 503
    missing = await client.post(f"{URL}/stores/nope/enqueue", headers=bearer(admin_token))
    assert missing.status_code == 404


def test_cron_uses_the_shared_schedule() -> None:
    jobs = {job.name: job for job in tasks.WorkerSettings.cron_jobs}
    for slug, (function, hour, minute) in operation.DAILY_SCRAPES.items():
        job = jobs[f"cron:{function}"]
        assert (job.hour, job.minute) == (hour, minute), slug
