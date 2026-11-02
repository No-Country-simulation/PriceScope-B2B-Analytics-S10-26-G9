import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models import Store, StoreCategory, StoreLocation


async def create_test_store(
    db: AsyncSession,
    slug: str = "tienda-prueba",
) -> Store:
    store = Store(
        name=f"Tienda {slug}",
        slug=slug,
        base_url="https://tienda.example.com",
        category=StoreCategory.SUPERMARKET,
        scraper_key=slug,
        active=True,
    )

    db.add(store)
    await db.flush()

    return store


async def test_store_can_have_multiple_locations() -> None:
    async with SessionLocal() as db:
        store = await create_test_store(db)

        db.add_all(
            [
                StoreLocation(
                    store_id=store.id,
                    code="sucursal-a",
                    name="Sucursal A",
                    city="Ciudad de prueba",
                    province="Provincia de prueba",
                    fulfillment_mode="pickup",
                ),
                StoreLocation(
                    store_id=store.id,
                    code="zona-b",
                    name="Zona B",
                    city="Ciudad de prueba",
                    province="Provincia de prueba",
                    postal_code="3500",
                    fulfillment_mode="delivery",
                ),
            ]
        )

        await db.commit()

    async with SessionLocal() as db:
        locations = (await db.scalars(select(StoreLocation).order_by(StoreLocation.code))).all()

    assert len(locations) == 2
    assert {loc.code for loc in locations} == {
        "sucursal-a",
        "zona-b",
    }

    assert {loc.fulfillment_mode for loc in locations} == {
        "pickup",
        "delivery",
    }


async def test_location_code_is_unique_per_store() -> None:
    async with SessionLocal() as db:
        store = await create_test_store(db)

        db.add_all(
            [
                StoreLocation(
                    store_id=store.id,
                    code="centro",
                    name="Centro 1",
                    fulfillment_mode="pickup",
                ),
                StoreLocation(
                    store_id=store.id,
                    code="centro",
                    name="Centro 2",
                    fulfillment_mode="pickup",
                ),
            ]
        )

        with pytest.raises(IntegrityError):
            await db.flush()

        await db.rollback()


async def test_different_stores_can_share_location_code() -> None:
    async with SessionLocal() as db:
        first = await create_test_store(db, "supermercado-uno")
        second = await create_test_store(db, "supermercado-dos")

        db.add_all(
            [
                StoreLocation(
                    store_id=first.id,
                    code="centro",
                    name="Centro A",
                    fulfillment_mode="pickup",
                ),
                StoreLocation(
                    store_id=second.id,
                    code="centro",
                    name="Centro B",
                    fulfillment_mode="pickup",
                ),
            ]
        )

        await db.commit()

        locations = (await db.scalars(select(StoreLocation))).all()

    assert len(locations) == 2


async def test_rejects_invalid_fulfillment_mode() -> None:
    async with SessionLocal() as db:
        store = await create_test_store(db)

        db.add(
            StoreLocation(
                store_id=store.id,
                code="invalida",
                name="Ubicacion de prueba",
                fulfillment_mode="unknown",
            )
        )

        with pytest.raises(IntegrityError):
            await db.flush()

        await db.rollback()
