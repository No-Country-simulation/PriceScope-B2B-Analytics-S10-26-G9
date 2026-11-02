from datetime import UTC, datetime, timedelta

import httpx

from app.core.database import SessionLocal
from app.models import ScrapingRun, Store, StoreCategory
from tests.conftest import bearer

URL = "/api/v1/admin/scraping/runs/recover"


async def test_recovery_requires_admin(
    client: httpx.AsyncClient,
    client_token: str,
) -> None:
    response = await client.post(URL)

    assert response.status_code == 401

    response = await client.post(
        URL,
        headers=bearer(client_token),
    )

    assert response.status_code == 403


async def test_admin_recovers_abandoned_runs(
    client: httpx.AsyncClient,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        store = Store(
            name="Carrefour de prueba",
            slug="carrefour",
            base_url="https://www.carrefour.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="carrefour",
            active=True,
        )

        db.add(store)
        await db.flush()

        now = datetime.now(UTC)

        abandoned = ScrapingRun(
            store_id=store.id,
            status="running",
            search_mode="term",
            search_value="leche",
            started_at=now - timedelta(hours=2),
        )

        recent = ScrapingRun(
            store_id=store.id,
            status="running",
            search_mode="term",
            search_value="arroz",
            started_at=now,
        )

        db.add_all([abandoned, recent])
        await db.commit()

        abandoned_id = abandoned.id
        recent_id = recent.id

    response = await client.post(
        URL,
        headers=bearer(admin_token),
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"recovered": 1}

    async with SessionLocal() as db:
        abandoned = await db.get(ScrapingRun, abandoned_id)
        recent = await db.get(ScrapingRun, recent_id)

        assert abandoned is not None
        assert recent is not None

        assert abandoned.status == "failed"
        assert abandoned.error_code == "RUN_INTERRUPTED"
        assert abandoned.finished_at is not None

        assert recent.status == "running"

    # Running recovery again must not modify more records.
    second_response = await client.post(
        URL,
        headers=bearer(admin_token),
    )

    assert second_response.status_code == 200
    assert second_response.json() == {"recovered": 0}
