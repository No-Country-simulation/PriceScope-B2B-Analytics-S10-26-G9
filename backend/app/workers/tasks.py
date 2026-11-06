import logging
from datetime import UTC

import aiosmtplib
import httpx
from arq import Retry, cron
from arq.worker import func
from sqlalchemy import select

from app.core.cache import arq_settings
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Store
from app.scrapers.vtex_client import VtexFetchError
from app.services import mail, rates
from app.services.scraping import scrape_vtex_store
from app.services.scraping_lock import (
    ScrapeAlreadyRunningError,
    scrape_store_lock,
)
from app.services.scraping_rate_limit import throttle_scraping_request
from app.services.scraping_recovery import (
    recover_stale_scraping_runs,
)
from app.services.scraping_retry import should_retry_vtex_error
from app.services.scraping_runs import (
    finish_scraping_run,
    start_scraping_run,
)

log = logging.getLogger(__name__)

MAX_TRIES = 5
SCRAPING_MAX_TRIES = 3
SCRAPING_RETRY_BASE_DELAY = 60

APPROVED_JOB_ORIGINS = {
    "carrefour": "https://www.carrefour.com.ar",
    "jumbo": "https://www.jumbo.com.ar",
}


async def startup(ctx: dict) -> None:
    """Create HTTP clients for worker jobs."""

    # Existing client used by exchange-rate ingestion.
    ctx["http"] = httpx.AsyncClient(timeout=10)

    # Dedicated client for controlled e-commerce requests.
    ctx["scraping_http"] = httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=False,
        trust_env=False,
        event_hooks={
            "request": [throttle_scraping_request],
        },
    )


async def shutdown(ctx: dict) -> None:
    await ctx["http"].aclose()
    await ctx["scraping_http"].aclose()


async def send_email(ctx: dict, to: str, subject: str, text: str, body_html: str) -> None:
    try:
        await mail.send_smtp(to, subject, text, body_html)
    except (aiosmtplib.SMTPException, OSError) as exc:
        if ctx["job_try"] >= MAX_TRIES:
            raise
        raise Retry(defer=ctx["job_try"] * 30) from exc


async def ingest_rates(ctx: dict) -> int:
    """Hourly job: stores the official and blue rates. If there is no source, logs and moves on."""
    try:
        async with SessionLocal() as db:
            return await rates.ingest_rates(db, ctx["http"])
    except rates.SourceError:
        log.error("Rate ingestion: no source answered")
        return 0


async def recover_scraping_runs(ctx: dict) -> int:
    """Recover abandoned scraping executions automatically."""

    recovered = await recover_stale_scraping_runs()

    if recovered:
        log.warning(
            "Scraping recovery: %s abandoned runs recovered",
            recovered,
        )

    return recovered


async def scrape_approved_store(
    ctx: dict,
    store_slug: str,
) -> dict[str, str | int]:
    """Run a controlled VTEX scraping job for an approved store."""

    expected_origin = APPROVED_JOB_ORIGINS.get(store_slug)

    if expected_origin is None:
        return {"status": "not_approved"}

    if (
        not settings.scraping_jobs_enabled
        or not settings.scraping_enabled
        or store_slug not in settings.scraping_allowed_stores
    ):
        return {"status": "disabled"}

    seller_ids = {
        seller_id.strip()
        for seller_id in settings.scraping_seller_ids.get(store_slug, [])
        if seller_id.strip()
    }

    if not seller_ids:
        return {"status": "not_configured"}

    async with SessionLocal() as db:
        store = await db.scalar(
            select(Store).where(
                Store.slug == store_slug,
                Store.base_url == expected_origin,
                Store.active.is_(True),
            )
        )

        if store is None:
            return {"status": "store_unavailable"}

        try:
            async with scrape_store_lock(store.id):
                run_id = await start_scraping_run(
                    store_id=store.id,
                    search_mode="term",
                    search_value="leche",
                )

                try:
                    result = await scrape_vtex_store(
                        db,
                        ctx["scraping_http"],
                        store=store,
                        own_seller_ids=seller_ids,
                        term="leche",
                        page_size=5,
                        max_pages=1,
                    )

                except Exception as exc:
                    await db.rollback()

                    if isinstance(exc, VtexFetchError):
                        error_code = "VTEX_FETCH_ERROR"
                        error_message = str(exc)[:300]
                    else:
                        error_code = "SCRAPING_ERROR"
                        error_message = type(exc).__name__

                    await finish_scraping_run(
                        run_id,
                        status="failed",
                        error_code=error_code,
                        error_message=error_message,
                    )


                    log.warning(
                        "Scraping failed for %s: %s",
                        store_slug,
                        error_code,
                    )

                    if (
                        isinstance(exc, VtexFetchError)
                        and should_retry_vtex_error(exc)
                    ):
                        attempt = ctx.get("job_try", 1)

                        if attempt < SCRAPING_MAX_TRIES:
                            delay = SCRAPING_RETRY_BASE_DELAY * (
                                2 ** (attempt - 1)
                            )

                            log.warning(
                                "Scheduling retry for %s: "
                                "attempt %s/%s, delay %ss",
                                store_slug,
                                attempt + 1,
                                SCRAPING_MAX_TRIES,
                                delay,
                            )

                            raise Retry(defer=delay) from exc

                    raise


                await finish_scraping_run(
                    run_id,
                    status="success",
                    products_received=result.products_received,
                    observations_saved=result.observations_saved,
                    skipped_duplicates=result.skipped_duplicates,
                )

                return {
                    "status": "success",
                    "products_received": result.products_received,
                    "observations_saved": result.observations_saved,
                }

        except ScrapeAlreadyRunningError:
            return {"status": "already_running"}


async def scrape_carrefour(ctx: dict) -> dict[str, str | int]:
    """Run a controlled Carrefour extraction."""
    return await scrape_approved_store(ctx, "carrefour")


async def scrape_jumbo(ctx: dict) -> dict[str, str | int]:
    """Run a controlled Jumbo extraction."""
    return await scrape_approved_store(ctx, "jumbo")



class WorkerSettings:
    functions = [
        send_email,
        func(scrape_carrefour, max_tries=SCRAPING_MAX_TRIES),
        func(scrape_jumbo, max_tries=SCRAPING_MAX_TRIES),
    ]

    cron_jobs = [
        # Existing exchange-rate ingestion: hourly.
        cron(ingest_rates, minute=0),

        # Existing scraping-run recovery: hourly.
        cron(
            recover_scraping_runs,
            minute=10,
            max_tries=1,
        ),

        # Carrefour: every day at 09:00 UTC (06:00 Argentina).
        cron(
            scrape_carrefour,
            hour=9,
            minute=0,
            second=0,
            run_at_startup=False,
            unique=True,
            max_tries=SCRAPING_MAX_TRIES,
        ),

        # Jumbo: every day at 09:30 UTC (06:30 Argentina).
        cron(
            scrape_jumbo,
            hour=9,
            minute=30,
            second=0,
            run_at_startup=False,
            unique=True,
            max_tries=SCRAPING_MAX_TRIES,
        ),
    ]

    on_startup = startup
    on_shutdown = shutdown
    redis_settings = arq_settings

    # Explicit timezone for all cron expressions.
    timezone = UTC

    max_tries = MAX_TRIES
