
"""Tests for bounded ARQ scraping retries."""

from decimal import Decimal

import httpx
import pytest
from arq import Retry
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Listing, Price, ScrapingRun, Store, StoreCategory
from app.scrapers.vtex_client import VtexFetchError
from app.workers import tasks


def configure_scraping(
    monkeypatch: pytest.MonkeyPatch,
    store_slug: str,
) -> None:
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


async def create_store(store_slug: str) -> None:
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


def sample_product() -> dict:
    return {
        "productName": "Leche de prueba 1L",
        "link": "/leche-prueba/p",
        "categories": ["/Lacteos/"],
        "items": [
            {
                "itemId": "SKU-RETRY-01",
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


@pytest.mark.parametrize(
    "store_slug",
    ["carrefour", "jumbo"],
)
async def test_temporary_failure_then_success(
    monkeypatch: pytest.MonkeyPatch,
    store_slug: str,
) -> None:
    configure_scraping(monkeypatch, store_slug)
    await create_store(store_slug)

    requests = 0

    def respond(request: httpx.Request) -> httpx.Response:
        nonlocal requests

        assert request.url.host == f"www.{store_slug}.com.ar"
        requests += 1

        if requests == 1:
            return httpx.Response(503)

        return httpx.Response(
            200,
            json=[sample_product()],
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond)
    ) as client:
        with pytest.raises(Retry) as retry:
            await tasks.scrape_approved_store(
                {"scraping_http": client, "job_try": 1},
                store_slug,
            )

        assert retry.value.defer_score == 60_000

        result = await tasks.scrape_approved_store(
            {"scraping_http": client, "job_try": 2},
            store_slug,
        )

    assert requests == 2
    assert result["status"] == "success"
    assert result["observations_saved"] == 1

    async with SessionLocal() as db:
        runs = (
            await db.scalars(
                select(ScrapingRun).order_by(
                    ScrapingRun.started_at
                )
            )
        ).all()

        listings = await db.scalar(
            select(func.count()).select_from(Listing)
        )
        prices = (
            await db.scalars(select(Price))
        ).all()

    assert len(runs) == 2
    assert {run.status for run in runs} == {
        "failed",
        "success",
    }

    assert listings == 1
    assert len(prices) == 1
    assert prices[0].local_price == Decimal("2200")


async def test_http_429_does_not_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_scraping(monkeypatch, "jumbo")
    await create_store("jumbo")

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                429,
                headers={"Retry-After": "120"},
            )
        )
    ) as client:
        with pytest.raises(VtexFetchError) as error:
            await tasks.scrape_jumbo(
                {"scraping_http": client, "job_try": 1}
            )

    assert error.value.status_code == 429

    async with SessionLocal() as db:
        runs = (await db.scalars(select(ScrapingRun))).all()

    assert len(runs) == 1
    assert runs[0].status == "failed"


async def test_third_failure_exhausts_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_scraping(monkeypatch, "jumbo")
    await create_store("jumbo")

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(503)
        )
    ) as client:
        with pytest.raises(VtexFetchError) as error:
            await tasks.scrape_jumbo(
                {"scraping_http": client, "job_try": 3}
            )

    assert error.value.status_code == 503

    async with SessionLocal() as db:
        run = await db.scalar(select(ScrapingRun))

    assert run is not None
    assert run.status == "failed"


def test_daily_cron_jobs_allow_three_attempts() -> None:
    jobs = {
        job.name: job
        for job in tasks.WorkerSettings.cron_jobs
    }

    assert jobs["cron:scrape_carrefour"].max_tries == 3
    assert jobs["cron:scrape_jumbo"].max_tries == 3
