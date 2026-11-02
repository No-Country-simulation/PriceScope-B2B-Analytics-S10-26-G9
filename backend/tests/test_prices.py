import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models import ExchangeRate, Listing, Price, RateType, Store, StoreCategory, StoreLocation
from app.services.prices import ScrapedObservation, record_observation


async def prepare() -> uuid.UUID:
    async with SessionLocal() as db:
        store = Store(
            name="Tienda T",
            slug="tienda-t",
            base_url="https://t.example.com",
            category=StoreCategory.ELECTRONICS,
            scraper_key="tienda_t",
        )
        now = datetime.now(UTC)
        db.add_all(
            [
                store,
                ExchangeRate(
                    source="dolarapi",
                    type=RateType.OFFICIAL,
                    quoted_at=now,
                    sell=Decimal("1500"),
                ),
                ExchangeRate(
                    source="dolarapi",
                    type=RateType.BLUE,
                    quoted_at=now,
                    sell=Decimal("1600"),
                ),
            ]
        )
        await db.commit()
        return store.id


def observation(store_id: uuid.UUID, **changes: object) -> ScrapedObservation:
    base = {
        "store_id": store_id,
        "external_code": "SKU-1",
        "name": "Smart TV 50",
        "url": "https://t.example.com/tv",
        "current_price": Decimal("750"),
        "strikethrough_price": Decimal("1000"),
    }
    return ScrapedObservation(**(base | changes))


async def test_promo_computes_regular_price_and_usd() -> None:
    store_id = await prepare()
    async with SessionLocal() as db:
        price = await record_observation(db, observation(store_id))

    assert price is not None
    assert price.is_promo is True
    assert price.regular_price == Decimal("1000")
    assert price.price_usd_official == Decimal("0.50")
    assert price.price_usd_blue == Decimal("0.47")


async def test_without_strikethrough_is_not_promo() -> None:
    store_id = await prepare()
    async with SessionLocal() as db:
        price = await record_observation(db, observation(store_id, strikethrough_price=None))

    assert price is not None
    assert price.is_promo is False
    assert price.regular_price == Decimal("750")


async def test_without_current_price_is_not_saved() -> None:
    store_id = await prepare()
    async with SessionLocal() as db:
        assert await record_observation(db, observation(store_id, current_price=None)) is None
        assert await db.scalar(select(func.count()).select_from(Price)) == 0


async def test_same_listing_is_reused() -> None:
    store_id = await prepare()
    async with SessionLocal() as db:
        await record_observation(db, observation(store_id))
        await record_observation(db, observation(store_id, current_price=Decimal("800")))
        assert await db.scalar(select(func.count()).select_from(Listing)) == 1
        assert await db.scalar(select(func.count()).select_from(Price)) == 2


async def test_absurd_strikethrough_is_discarded() -> None:
    store_id = await prepare()
    async with SessionLocal() as db:
        price = await record_observation(
            db,
            observation(
                store_id, current_price=Decimal("5208"), strikethrough_price=Decimal("430413")
            ),
        )

    assert price is not None
    assert price.is_promo is False
    assert price.strikethrough_price is None
    assert price.regular_price == Decimal("5208")


async def test_observation_without_commit_can_be_rolled_back() -> None:
    store_id = await prepare()

    async with SessionLocal() as db:
        price = await record_observation(
            db,
            observation(store_id),
            commit=False,
        )

        assert price is not None

        await db.rollback()

    async with SessionLocal() as verification_db:
        listing_count = await verification_db.scalar(select(func.count()).select_from(Listing))
        price_count = await verification_db.scalar(select(func.count()).select_from(Price))

    assert listing_count == 0
    assert price_count == 0


async def test_same_product_prices_by_location() -> None:
    store_id = await prepare()

    async with SessionLocal() as db:
        first = StoreLocation(
            store_id=store_id,
            code="sucursal-a",
            name="Sucursal A",
            fulfillment_mode="pickup",
        )

        second = StoreLocation(
            store_id=store_id,
            code="sucursal-b",
            name="Sucursal B",
            fulfillment_mode="pickup",
        )

        db.add_all([first, second])
        await db.commit()

        captured_at = datetime.now(UTC)

        await record_observation(
            db,
            observation(
                store_id,
                location_id=first.id,
                current_price=Decimal("1800"),
            ),
            captured_at=captured_at,
        )

        await record_observation(
            db,
            observation(
                store_id,
                location_id=second.id,
                current_price=Decimal("1950"),
            ),
            captured_at=captured_at + timedelta(seconds=1),
        )

    async with SessionLocal() as db:
        prices = (await db.scalars(select(Price).order_by(Price.captured_at))).all()

        listing_count = await db.scalar(select(func.count()).select_from(Listing))

    assert listing_count == 1
    assert len(prices) == 2

    assert prices[0].location_id == first.id
    assert prices[0].local_price == Decimal("1800")

    assert prices[1].location_id == second.id
    assert prices[1].local_price == Decimal("1950")


async def test_price_without_location_remains_supported() -> None:
    store_id = await prepare()

    async with SessionLocal() as db:
        await record_observation(
            db,
            observation(store_id),
        )

    async with SessionLocal() as db:
        price = await db.scalar(select(Price))

    assert price is not None
    assert price.location_id is None


async def test_rejects_location_from_another_store() -> None:
    first_store_id = await prepare()

    async with SessionLocal() as db:
        second_store = Store(
            name="Otra tienda",
            slug="otra-tienda",
            base_url="https://otra.example.com",
            category=StoreCategory.SUPERMARKET,
            scraper_key="otra-tienda",
        )

        db.add(second_store)
        await db.flush()

        foreign_location = StoreLocation(
            store_id=second_store.id,
            code="centro",
            name="Sucursal Centro",
            fulfillment_mode="pickup",
        )

        db.add(foreign_location)
        await db.commit()

        with pytest.raises(
            ValueError,
            match="no pertenece a la tienda",
        ):
            await record_observation(
                db,
                observation(
                    first_store_id,
                    location_id=foreign_location.id,
                ),
            )

        await db.rollback()

    async with SessionLocal() as db:
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_rejects_inactive_location() -> None:
    store_id = await prepare()

    async with SessionLocal() as db:
        location = StoreLocation(
            store_id=store_id,
            code="inactiva",
            name="Sucursal inactiva",
            fulfillment_mode="pickup",
            active=False,
        )

        db.add(location)
        await db.commit()

        with pytest.raises(
            ValueError,
            match="está inactiva",
        ):
            await record_observation(
                db,
                observation(
                    store_id,
                    location_id=location.id,
                ),
            )

        await db.rollback()
