from datetime import UTC, datetime, timedelta

from app.core.database import SessionLocal
from app.models import ScrapingRun, Store, StoreCategory
from app.services.scraping_lock import scrape_store_lock
from app.services.scraping_recovery import (
    recover_stale_scraping_runs,
)


async def create_store_and_runs():
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

        completed = ScrapingRun(
            store_id=store.id,
            status="success",
            search_mode="term",
            search_value="aceite",
            started_at=now - timedelta(hours=3),
            finished_at=now - timedelta(hours=3),
        )

        db.add_all([abandoned, recent, completed])
        await db.commit()

        return store.id, abandoned.id, recent.id, completed.id


async def test_recovers_only_abandoned_runs() -> None:
    _, abandoned_id, recent_id, completed_id = await create_store_and_runs()

    recovered = await recover_stale_scraping_runs()

    assert recovered == 1

    async with SessionLocal() as db:
        abandoned = await db.get(ScrapingRun, abandoned_id)
        recent = await db.get(ScrapingRun, recent_id)
        completed = await db.get(ScrapingRun, completed_id)

    assert abandoned.status == "failed"
    assert abandoned.finished_at is not None
    assert abandoned.error_code == "RUN_INTERRUPTED"

    assert recent.status == "running"
    assert completed.status == "success"

    # Running recovery twice must not change more records.
    assert await recover_stale_scraping_runs() == 0


async def test_does_not_recover_active_store() -> None:
    store_id, abandoned_id, _, _ = await create_store_and_runs()

    # Simulate a scraper currently holding the store lock.
    async with scrape_store_lock(store_id):
        recovered = await recover_stale_scraping_runs()

    assert recovered == 0

    async with SessionLocal() as db:
        run = await db.get(ScrapingRun, abandoned_id)

    assert run.status == "running"

    # After the lock is released, recovery becomes possible.
    assert await recover_stale_scraping_runs() == 1

    async with SessionLocal() as db:
        run = await db.get(ScrapingRun, abandoned_id)

    assert run.status == "failed"
