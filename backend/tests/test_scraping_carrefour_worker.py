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
from app.scrapers.vtex_client import VtexFetchError
from app.workers import tasks


def enable_job(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "scraping_jobs_enabled", True)
    monkeypatch.setattr(settings, "scraping_enabled", True)
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        ["carrefour"],
    )
    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {"carrefour": ["1"]},
    )


async def create_carrefour() -> None:
    async with SessionLocal() as db:
        store = Store(
            name="Carrefour Argentina",
            slug="carrefour",
            base_url="https://www.carrefour.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="carrefour",
            active=True,
        )
        db.add(store)
        await db.commit()


def sample_product() -> dict:
    return {
        "productName": "Leche de prueba",
        "link": "/leche-de-prueba/p",
        "categories": ["/Lacteos/Leches/"],
        "items": [
            {
                "itemId": "42896",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "commertialOffer": {
                            "Price": 3245,
                            "ListPrice": 3245,
                            "AvailableQuantity": 10,
                        },
                    }
                ],
            }
        ],
    }


async def test_carrefour_job_is_disabled_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "scraping_jobs_enabled", False)

    result = await tasks.scrape_carrefour({})

    assert result == {"status": "disabled"}


async def test_carrefour_job_saves_prices_and_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enable_job(monkeypatch)
    await create_carrefour()

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.carrefour.com.ar"
        assert request.url.params["ft"] == "leche"
        return httpx.Response(
            200,
            json=[sample_product()],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await tasks.scrape_carrefour({"scraping_http": client})

    assert result["status"] == "success"
    assert result["products_received"] == 1
    assert result["observations_saved"] == 1

    async with SessionLocal() as db:
        listing_count = await db.scalar(select(func.count()).select_from(Listing))
        price_count = await db.scalar(select(func.count()).select_from(Price))
        run = await db.scalar(select(ScrapingRun))

    assert listing_count == 1
    assert price_count == 1
    assert run is not None
    assert run.status == "success"
    assert run.observations_saved == 1
    assert run.finished_at is not None


async def test_carrefour_job_records_http_429(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enable_job(monkeypatch)
    await create_carrefour()

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(429))
    ) as client:
        with pytest.raises(VtexFetchError, match="429"):
            await tasks.scrape_carrefour({"scraping_http": client})

    async with SessionLocal() as db:
        run = await db.scalar(select(ScrapingRun))
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert run is not None
    assert run.status == "failed"
    assert run.error_code == "VTEX_FETCH_ERROR"
    assert run.finished_at is not None
    assert price_count == 0


def test_carrefour_job_allows_bounded_retries() -> None:
    registered = [
        job
        for job in tasks.WorkerSettings.functions
        if getattr(job, "name", None) == "scrape_carrefour"
    ]

    assert len(registered) == 1
    assert registered[0].max_tries == 3


@pytest.mark.parametrize(
    ("scraping_enabled", "allowed_stores"),
    [
        (False, ["carrefour"]),
        (True, []),
    ],
)
async def test_carrefour_requires_scraping_permissions(
    monkeypatch: pytest.MonkeyPatch,
    scraping_enabled: bool,
    allowed_stores: list[str],
) -> None:
    """The worker must respect global and store permissions."""

    enable_job(monkeypatch)

    monkeypatch.setattr(
        settings,
        "scraping_enabled",
        scraping_enabled,
    )
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        allowed_stores,
    )

    result = await tasks.scrape_carrefour({})

    assert result == {"status": "disabled"}


async def test_carrefour_requires_configured_sellers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Never scrape without approved seller identifiers."""

    enable_job(monkeypatch)

    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {"carrefour": []},
    )

    result = await tasks.scrape_carrefour({})

    assert result == {"status": "not_configured"}
