"""Tests for Jumbo catalogue integration."""

from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.api.v1.admin_scraping import get_scraping_http
from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import Listing, Price, Store, StoreCategory
from tests.conftest import bearer

URL = "/api/v1/admin/scraping/run"

PAYLOAD = {
    "store_slug": "jumbo",
    "term": "leche",
    "page_size": 5,
    "max_pages": 1,
}


@pytest.fixture
async def jumbo_store() -> Store:
    async with SessionLocal() as db:
        store = Store(
            name="Jumbo Argentina",
            slug="jumbo",
            base_url="https://www.jumbo.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="jumbo",
            active=True,
        )

        db.add(store)
        await db.commit()

        return store


@pytest.fixture
def enable_jumbo(monkeypatch: pytest.MonkeyPatch) -> None:
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


def product(sku: str, seller_id: str, price: int) -> dict:
    return {
        "productName": f"Leche de prueba {sku}",
        "link": f"/leche-{sku}/p",
        "categories": ["/Lacteos/Leches/"],
        "items": [
            {
                "itemId": sku,
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": seller_id,
                        "sellerName": (
                            "Jumbo Argentina IO" if seller_id == "1" else "Vendedor externo"
                        ),
                        "commertialOffer": {
                            "Price": price,
                            "ListPrice": price,
                            "AvailableQuantity": 10,
                        },
                    }
                ],
            }
        ],
    }


async def test_jumbo_saves_only_own_seller_prices(
    client: httpx.AsyncClient,
    admin_token: str,
    jumbo_store: Store,
    enable_jumbo: None,
) -> None:
    products = [
        product("JUMBO-101", "1", 2200),
        product("EXTERNAL-102", "99", 1900),
    ]

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.jumbo.com.ar"
        assert request.url.params["ft"] == "leche"

        return httpx.Response(200, json=products)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            response = await client.post(
                URL,
                json=PAYLOAD,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(
                get_scraping_http,
                None,
            )

    assert response.status_code == 200, response.text

    result = response.json()

    assert result["store"] == "jumbo"
    assert result["products_received"] == 2
    assert result["observations_saved"] == 1
    assert result["skipped_duplicates"] == 0

    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(
                    Store.slug,
                    Listing.external_code,
                    Price.local_price,
                    Price.location_id,
                )
                .select_from(Price)
                .join(
                    Listing,
                    Listing.id == Price.listing_id,
                )
                .join(
                    Store,
                    Store.id == Listing.store_id,
                )
            )
        ).all()

    assert len(rows) == 1

    slug, sku, price, location_id = rows[0]

    assert slug == "jumbo"
    assert sku == "JUMBO-101"
    assert price == Decimal("2200")
    assert location_id is None


async def test_jumbo_requires_explicit_authorization(
    client: httpx.AsyncClient,
    admin_token: str,
    jumbo_store: Store,
    enable_jumbo: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        ["carrefour"],
    )

    response = await client.post(
        URL,
        json=PAYLOAD,
        headers=bearer(admin_token),
    )

    assert response.status_code == 403
