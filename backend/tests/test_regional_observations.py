import uuid
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models import (
    Listing,
    Price,
    Store,
    StoreCategory,
    StoreLocation,
)
from app.scrapers.vtex_regional import (
    VtexRegionalContext,
    context_from_location,
)
from app.services.regional_observations import (
    prepare_regional_observations,
)


def make_store() -> Store:
    return Store(
        id=uuid.uuid4(),
        name="Supermercado de prueba",
        slug="tienda-prueba",
        base_url="https://tienda.example.com",
        category=StoreCategory.SUPERMARKET,
        scraper_key="tienda-prueba",
        active=True,
    )


def make_location(
    store: Store,
    region_id: str = "region-a",
) -> StoreLocation:
    return StoreLocation(
        id=uuid.uuid4(),
        store_id=store.id,
        code=f"zona-{region_id}",
        name="Zona de prueba",
        fulfillment_mode="delivery",
        sales_channel="1",
        region_id=region_id,
        active=True,
    )


def make_product(price: int = 1500) -> dict:
    return {
        "productId": "101",
        "productName": "Leche de prueba",
        "link": "/leche-de-prueba/p",
        "categories": ["/Lacteos/"],
        "items": [
            {
                "itemId": "SKU-101",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "sellerName": "Vendedor principal",
                        "commertialOffer": {
                            "Price": price,
                            "ListPrice": price,
                            "AvailableQuantity": 5,
                        },
                    },
                    {
                        "sellerId": "99",
                        "sellerName": "Vendedor externo",
                        "commertialOffer": {
                            "Price": 1200,
                            "AvailableQuantity": 5,
                        },
                    },
                ],
            }
        ],
    }


async def test_prepares_regional_observation_without_saving() -> None:
    store = make_store()
    location = make_location(store)

    observations = prepare_regional_observations(
        [make_product()],
        store=store,
        location=location,
        requested_context=context_from_location(location),
        own_seller_ids={"1"},
    )

    assert len(observations) == 1

    observation = observations[0]

    assert observation.store_id == store.id
    assert observation.location_id == location.id
    assert observation.external_code == "SKU-101"
    assert observation.current_price == Decimal("1500")

    async with SessionLocal() as db:
        listings = await db.scalar(select(func.count()).select_from(Listing))
        prices = await db.scalar(select(func.count()).select_from(Price))

    assert listings == 0
    assert prices == 0


def test_rejects_location_from_another_store() -> None:
    store = make_store()
    other_store = make_store()
    location = make_location(other_store)

    with pytest.raises(
        ValueError,
        match="no pertenece a la tienda",
    ):
        prepare_regional_observations(
            [make_product()],
            store=store,
            location=location,
            requested_context=context_from_location(location),
            own_seller_ids={"1"},
        )


def test_rejects_different_requested_region() -> None:
    store = make_store()
    location = make_location(store, "region-a")

    with pytest.raises(
        ValueError,
        match="no coincide",
    ):
        prepare_regional_observations(
            [make_product()],
            store=store,
            location=location,
            requested_context=VtexRegionalContext(
                sales_channel="1",
                region_id="region-b",
            ),
            own_seller_ids={"1"},
        )


def test_removes_duplicate_skus() -> None:
    store = make_store()
    location = make_location(store)
    product = make_product()

    observations = prepare_regional_observations(
        [product, product],
        store=store,
        location=location,
        requested_context=context_from_location(location),
        own_seller_ids={"1"},
    )

    assert len(observations) == 1


def test_same_sku_can_have_different_regional_prices() -> None:
    store = make_store()
    first_location = make_location(store, "region-a")
    second_location = make_location(store, "region-b")

    first = prepare_regional_observations(
        [make_product(1500)],
        store=store,
        location=first_location,
        requested_context=context_from_location(first_location),
        own_seller_ids={"1"},
    )

    second = prepare_regional_observations(
        [make_product(1800)],
        store=store,
        location=second_location,
        requested_context=context_from_location(second_location),
        own_seller_ids={"1"},
    )

    assert first[0].external_code == second[0].external_code

    assert first[0].location_id != second[0].location_id

    assert first[0].current_price == Decimal("1500")
    assert second[0].current_price == Decimal("1800")
