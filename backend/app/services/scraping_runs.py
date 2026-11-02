"""Persist scraping execution history."""

import uuid
from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.models import ScrapingRun


async def start_scraping_run(
    *,
    store_id: uuid.UUID,
    search_mode: str,
    search_value: str,
) -> uuid.UUID:
    """Create a durable record before scraping starts."""

    async with SessionLocal() as db:
        run = ScrapingRun(
            store_id=store_id,
            status="running",
            search_mode=search_mode,
            search_value=search_value,
        )

        db.add(run)
        await db.commit()

        return run.id


async def finish_scraping_run(
    run_id: uuid.UUID,
    *,
    status: str,
    products_received: int = 0,
    observations_saved: int = 0,
    skipped_duplicates: int = 0,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    """Finish a run using an independent database transaction."""

    if status not in {"success", "failed"}:
        raise ValueError("Invalid scraping run status")

    async with SessionLocal() as db:
        run = await db.get(ScrapingRun, run_id)

        if run is None:
            raise ValueError("Scraping run not found")

        run.status = status
        run.finished_at = datetime.now(UTC)

        run.products_received = products_received
        run.observations_saved = observations_saved
        run.skipped_duplicates = skipped_duplicates

        run.error_code = error_code
        run.error_message = error_message

        await db.commit()
