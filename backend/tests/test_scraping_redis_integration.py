
"""Integration test: real ARQ/Redis retries, simulated VTEX HTTP."""

import asyncio
from uuid import uuid4

import httpx
import pytest
from arq import create_pool
from arq.worker import Worker, func
from sqlalchemy import func as sa_func
from sqlalchemy import select

from app.core.cache import arq_settings
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Listing, Price, ScrapingRun, Store, StoreCategory
from app.workers import tasks


def sample_product() -> dict:
    return {
        "productName": "Leche de prueba 1L",
        "link": "/leche-de-prueba/p",
        "categories": ["/Lacteos/"],
        "items": [
            {
                "itemId": "SKU-REDIS-01",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "commertialOffer": {
                            "Price": 2200,
                            "ListPrice": 2200,
                            "AvailableQuantity": 10,
                        },
                    }
                ],
            }
        ],
    }


@pytest.mark.integration
@pytest.mark.parametrize(
    ("store_slug", "job_function"),
    [
        ("carrefour", tasks.scrape_carrefour),
        ("jumbo", tasks.scrape_jumbo),
    ],
)
async def test_redis_retries_and_persists_once(
    monkeypatch: pytest.MonkeyPatch,
    store_slug: str,
    job_function,
) -> None:
    """First attempt fails; Redis executes the successful retry."""

    monkeypatch.setattr(settings, "scraping_enabled", True)
    monkeypatch.setattr(settings, "scraping_jobs_enabled", True)
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        [store_slug],
    )
    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {store_slug: ["1"]},
    )

    # Short delay only during this automated test.
    monkeypatch.setattr(
        tasks,
        "SCRAPING_RETRY_BASE_DELAY",
        0.1,
    )

    async with SessionLocal() as db:
        db.add(
            Store(
                name=store_slug.capitalize(),
                slug=store_slug,
                base_url=f"https://www.{store_slug}.com.ar",
                category=StoreCategory.SUPERMARKET,
                scraper_key=store_slug,
                active=True,
            )
        )
        await db.commit()

    request_count = 0

    def respond(request: httpx.Request) -> httpx.Response:
        nonlocal request_count

        assert request.url.host == f"www.{store_slug}.com.ar"
        assert request.url.params["ft"] == "leche"

        request_count += 1

        if request_count == 1:
            return httpx.Response(503)

        return httpx.Response(
            200,
            json=[sample_product()],
        )

    # Unique Redis queue: does not touch the normal worker queue.
    queue_name = f"arq:test:scraping:{uuid4().hex}"

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond)
    ) as fake_http:
        pool = await create_pool(
            arq_settings,
            default_queue_name=queue_name,
        )

        worker = None

        try:
            job = await pool.enqueue_job(
                job_function.__name__,
            )

            assert job is not None

            worker = Worker(
                functions=[
                    func(job_function, max_tries=3),
                ],
                redis_pool=pool,
                queue_name=queue_name,
                cron_jobs=[],
                burst=True,
                poll_delay=0.05,
                handle_signals=True,
                ctx={"scraping_http": fake_http},
            )

            # Process queued jobs, including the deferred retry.
            await asyncio.wait_for(
                worker.async_run(),
                timeout=15,
            )

            result = await job.result(
                timeout=3,
                poll_delay=0.05,
            )

            assert result["status"] == "success"
            assert result["observations_saved"] == 1

            assert worker.jobs_retried == 1
            assert worker.jobs_complete == 1
            assert worker.jobs_failed == 0

        finally:
            if worker is not None:
                await worker.close()
            else:
                await pool.close(
                    close_connection_pool=True
                )

    assert request_count == 2

    async with SessionLocal() as db:
        runs = (
            await db.scalars(
                select(ScrapingRun)
            )
        ).all()

        listing_count = await db.scalar(
            select(sa_func.count()).select_from(Listing)
        )

        price_count = await db.scalar(
            select(sa_func.count()).select_from(Price)
        )

    assert len(runs) == 2

    assert sorted(run.status for run in runs) == [
        "failed",
        "success",
    ]

    assert listing_count == 1
    assert price_count == 1
