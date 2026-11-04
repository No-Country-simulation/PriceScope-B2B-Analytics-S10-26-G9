"""Tests for the Jumbo ARQ scraping job."""

import httpx
import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import (
    Listing,
    Price,
    ScrapingRun,
    Store,
    StoreCategory,
)
from app.workers import tasks


def enable_jumbo(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "scraping_jobs_enabled", True)
    monkeypatch.setattr(settings, "scraping_enabled", True)
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        ["jumbo"],
    )
    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {"jumbo": ["1"]},
    )


async def create_jumbo(
    base_url: str = "https://www.jumbo.com.ar",
) -> None:
    async with SessionLocal() as db:
        db.add(
            Store(
                name="Jumbo Argentina",
                slug="jumbo",
                base_url=base_url,
                category=StoreCategory.SUPERMARKET,
                scraper_key="jumbo",
                active=True,
            )
        )
        await db.commit()


def product() -> dict:
    return {
        "productName": "Leche de prueba Jumbo",
        "link": "/leche-prueba/p",
        "categories": ["/Lacteos/Leches/"],
        "items": [
            {
                "itemId": "JUMBO-101",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "sellerName": "Jumbo Argentina IO",
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


async def test_jumbo_job_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "scraping_jobs_enabled",
        False,
    )

    result = await tasks.scrape_jumbo({})

    assert result == {"status": "disabled"}


async def test_jumbo_job_saves_prices_and_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enable_jumbo(monkeypatch)
    await create_jumbo()

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.jumbo.com.ar"
        assert request.url.params["ft"] == "leche"

        return httpx.Response(200, json=[product()])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await tasks.scrape_jumbo({"scraping_http": client})

    assert result["status"] == "success"
    assert result["products_received"] == 1
    assert result["observations_saved"] == 1

    async with SessionLocal() as db:
        listings = await db.scalar(select(func.count()).select_from(Listing))
        prices = await db.scalar(select(func.count()).select_from(Price))
        run = await db.scalar(select(ScrapingRun))

    assert listings == 1
    assert prices == 1

    assert run is not None
    assert run.status == "success"
    assert run.finished_at is not None


async def test_jumbo_rejects_unapproved_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enable_jumbo(monkeypatch)

    await create_jumbo(base_url="https://example.com")

    result = await tasks.scrape_jumbo({})

    assert result == {"status": "store_unavailable"}


def test_jumbo_is_registered_without_retries() -> None:
    registered = [
        job
        for job in tasks.WorkerSettings.functions
        if getattr(job, "name", None) == "scrape_jumbo"
    ]

    assert len(registered) == 1
    assert registered[0].max_tries == 1
