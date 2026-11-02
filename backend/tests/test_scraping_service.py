from decimal import Decimal
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models import Listing, Price, Store, StoreCategory
from app.scrapers.vtex_client import VtexFetchError
from app.services import scraping
from app.services.scraping import scrape_vtex_store

BASE_URL = "https://tienda.example.com"


async def create_store(
    db: AsyncSession,
    *,
    active: bool = True,
) -> Store:
    store = Store(
        name="Tienda de prueba",
        slug="tienda-prueba",
        base_url=BASE_URL,
        category=StoreCategory.SUPERMARKET,
        scraper_key="tienda_prueba",
        active=active,
    )
    db.add(store)
    await db.commit()
    return store


def vtex_product(
    sku: str,
    price: int,
    *,
    stock: int = 10,
    seller_id: str = "1",
) -> dict:
    return {
        "productName": f"Producto {sku}",
        "link": f"/producto-{sku.lower()}/p",
        "categories": ["/Almacen/"],
        "items": [
            {
                "itemId": sku,
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": seller_id,
                        "sellerName": "Tienda propia",
                        "commertialOffer": {
                            "Price": price,
                            "ListPrice": price + 200,
                            "AvailableQuantity": stock,
                        },
                    }
                ],
            }
        ],
    }


async def test_scraping_saves_listings_and_prices() -> None:
    products = [
        vtex_product("SKU-101", 1500),
        vtex_product("SKU-102", 1700, stock=0),
        vtex_product("SKU-103", 2000, seller_id="99"),
        vtex_product("SKU-104", 0),
    ]

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "tienda.example.com"
        assert request.url.params["ft"] == "leche"
        return httpx.Response(200, json=products)

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        result = await scrape_vtex_store(
            db,
            client,
            store=store,
            term="leche",
            own_seller_ids={"1"},
            page_size=10,
        )

        listings = (await db.scalars(select(Listing).order_by(Listing.external_code))).all()

        prices = (await db.scalars(select(Price).order_by(Price.local_price))).all()

    assert result.store == "tienda-prueba"
    assert result.products_received == 4
    assert result.observations_saved == 2
    assert result.skipped_duplicates == 0

    assert len(listings) == 2
    assert len(prices) == 2

    assert {item.external_code for item in listings} == {
        "SKU-101",
        "SKU-102",
    }

    assert prices[0].local_price == Decimal("1500")
    assert prices[0].regular_price == Decimal("1700")
    assert prices[0].is_promo is True

    assert prices[1].local_price == Decimal("1700")
    assert prices[1].available is False
    async with SessionLocal() as verification_db:
        assert await verification_db.scalar(select(func.count()).select_from(Price)) == 2


async def test_duplicated_sku_is_saved_once() -> None:
    product = vtex_product("SKU-101", 1500)
    pause = AsyncMock()

    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(206, json=[product])

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        result = await scrape_vtex_store(
            db,
            client,
            store=store,
            term="leche",
            own_seller_ids={"1"},
            page_size=1,
            max_pages=2,
            pause=pause,
        )

        listing_count = await db.scalar(select(func.count()).select_from(Listing))

        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert result.products_received == 2
    assert result.observations_saved == 1
    assert result.skipped_duplicates == 1

    assert listing_count == 1
    assert price_count == 1

    pause.assert_awaited_once_with(1.0)


async def test_http_failure_does_not_save_prices() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        with pytest.raises(VtexFetchError):
            await scrape_vtex_store(
                db,
                client,
                store=store,
                term="leche",
                own_seller_ids={"1"},
            )

        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_inactive_store_is_rejected() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        pytest.fail("No HTTP request should be made")

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db, active=False)

        with pytest.raises(ValueError, match="inactive store"):
            await scrape_vtex_store(
                db,
                client,
                store=store,
                term="leche",
                own_seller_ids={"1"},
            )


async def test_multiple_categories_skip_duplicate_skus() -> None:
    first = vtex_product("SKU-101", 1500)
    second = vtex_product("SKU-102", 1700)

    pause = AsyncMock()
    requested_categories = []

    def respond(request: httpx.Request) -> httpx.Response:
        category = request.url.params["fq"]
        requested_categories.append(category)

        if category == "C:123":
            return httpx.Response(200, json=[first])

        if category == "C:124":
            return httpx.Response(200, json=[first, second])

        pytest.fail(f"Unexpected category: {category}")

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        result = await scrape_vtex_store(
            db,
            client,
            store=store,
            category_ids=[123, 124],
            own_seller_ids={"1"},
            page_size=10,
            max_pages=1,
            pause=pause,
        )

        listing_count = await db.scalar(select(func.count()).select_from(Listing))

        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert requested_categories == ["C:123", "C:124"]

    assert result.products_received == 3
    assert result.observations_saved == 2
    assert result.skipped_duplicates == 1

    assert listing_count == 2
    assert price_count == 2

    pause.assert_awaited_once_with(1.0)


async def test_second_category_failure_saves_nothing() -> None:
    first = vtex_product("SKU-101", 1500)

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.params["fq"] == "C:123":
            return httpx.Response(200, json=[first])

        return httpx.Response(503)

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        with pytest.raises(VtexFetchError):
            await scrape_vtex_store(
                db,
                client,
                store=store,
                category_ids=[123, 124],
                own_seller_ids={"1"},
                page_size=10,
                max_pages=1,
                pause=AsyncMock(),
            )

        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_scraping_rolls_back_if_second_save_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    products = [
        vtex_product("SKU-101", 1500),
        vtex_product("SKU-102", 1700),
    ]

    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=products)

    original_record = scraping.record_observation
    calls = 0

    async def failing_record(*args, **kwargs):
        nonlocal calls
        calls += 1

        if calls == 2:
            raise RuntimeError("Simulated database failure")

        return await original_record(*args, **kwargs)

    monkeypatch.setattr(
        scraping,
        "record_observation",
        failing_record,
    )

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        store = await create_store(db)

        with pytest.raises(
            RuntimeError,
            match="Simulated database failure",
        ):
            await scrape_vtex_store(
                db,
                client,
                store=store,
                term="leche",
                own_seller_ids={"1"},
                page_size=10,
                max_pages=1,
            )

    # Check persistence in a separate session.
    async with SessionLocal() as verification_db:
        listing_count = await verification_db.scalar(select(func.count()).select_from(Listing))
        price_count = await verification_db.scalar(select(func.count()).select_from(Price))

    assert calls == 2
    assert listing_count == 0
    assert price_count == 0
