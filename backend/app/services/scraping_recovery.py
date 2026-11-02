"""Recover scraping runs interrupted before completion."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.core.database import SessionLocal
from app.models import ScrapingRun
from app.services.scraping_lock import (
    ScrapeAlreadyRunningError,
    scrape_store_lock,
)

STALE_AFTER = timedelta(minutes=30)


async def recover_stale_scraping_runs(
    *,
    older_than: timedelta = STALE_AFTER,
) -> int:
    """Mark abandoned runs as failed without touching active jobs."""

    if older_than <= timedelta(0):
        raise ValueError("Recovery interval must be positive")

    cutoff = datetime.now(UTC) - older_than

    # Find stores with potentially abandoned executions.
    async with SessionLocal() as db:
        store_ids = (
            await db.scalars(
                select(ScrapingRun.store_id)
                .where(
                    ScrapingRun.status == "running",
                    ScrapingRun.started_at < cutoff,
                )
                .distinct()
            )
        ).all()

    recovered = 0

    for store_id in store_ids:
        try:
            # An active scraper holds this same database lock.
            async with scrape_store_lock(store_id):
                async with SessionLocal() as db:
                    result = await db.execute(
                        update(ScrapingRun)
                        .where(
                            ScrapingRun.store_id == store_id,
                            ScrapingRun.status == "running",
                            ScrapingRun.started_at < cutoff,
                        )
                        .values(
                            status="failed",
                            finished_at=datetime.now(UTC),
                            error_code="RUN_INTERRUPTED",
                            error_message=(
                                "La ejecucion quedo sin finalizar y fue recuperada como fallida."
                            ),
                        )
                    )

                    await db.commit()
                    recovered += result.rowcount or 0

        except ScrapeAlreadyRunningError:
            # This store still has an active scraping operation.
            continue

    return recovered
