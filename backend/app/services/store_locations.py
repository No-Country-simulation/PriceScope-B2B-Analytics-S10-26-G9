"""Store location operations."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Store, StoreLocation
from app.schemas.store_locations import StoreLocationCreate, StoreLocationRegionalContextInput
from app.services.errors import ConflictError, NotFoundError


async def get_active_store(
    db: AsyncSession,
    slug: str,
) -> Store:
    """Return an active store or raise a 404 business error."""

    store = await db.scalar(
        select(Store).where(
            Store.slug == slug,
            Store.active.is_(True),
        )
    )

    if store is None:
        raise NotFoundError("La tienda no existe o está inactiva")

    return store


async def list_store_locations(
    db: AsyncSession,
    store_slug: str,
) -> list[StoreLocation]:
    """List the configured locations for one store."""

    store = await get_active_store(db, store_slug)

    locations = await db.scalars(
        select(StoreLocation).where(StoreLocation.store_id == store.id).order_by(StoreLocation.name)
    )

    return list(locations)


async def create_store_location(
    db: AsyncSession,
    store_slug: str,
    data: StoreLocationCreate,
) -> StoreLocation:
    """Create a location without duplicating its code."""

    store = await get_active_store(db, store_slug)

    existing = await db.scalar(
        select(StoreLocation.id).where(
            StoreLocation.store_id == store.id,
            StoreLocation.code == data.code,
        )
    )

    if existing is not None:
        raise ConflictError("Ya existe una ubicación con ese código para esta tienda")

    location = StoreLocation(
        store_id=store.id,
        code=data.code,
        name=data.name,
        city=data.city,
        province=data.province,
        postal_code=data.postal_code,
        fulfillment_mode=data.fulfillment_mode,
        active=True,
    )

    db.add(location)

    try:
        await db.commit()

    except IntegrityError as exc:
        await db.rollback()

        # Also protect against concurrent registrations.
        if getattr(exc.orig, "sqlstate", None) == "23505":
            raise ConflictError("Ya existe una ubicación con ese código para esta tienda") from exc

        raise

    return location


async def get_active_location(
    db: AsyncSession,
    store_id: uuid.UUID,
    location_id: uuid.UUID,
) -> StoreLocation:
    """Find an active location belonging to a specific store."""

    location = await db.scalar(
        select(StoreLocation).where(
            StoreLocation.id == location_id,
            StoreLocation.store_id == store_id,
            StoreLocation.active.is_(True),
        )
    )

    if location is None:
        raise NotFoundError("La ubicación no existe, está inactiva o no pertenece a la tienda")

    return location


async def configure_regional_context(
    db: AsyncSession,
    store_slug: str,
    location_id: uuid.UUID,
    data: StoreLocationRegionalContextInput,
) -> StoreLocation:
    """Save unverified regional identifiers for later validation."""

    store = await get_active_store(db, store_slug)

    location = await get_active_location(
        db,
        store.id,
        location_id,
    )

    if location.fulfillment_mode != "delivery":
        raise ConflictError(
            "Por ahora solo se admite contexto regional para ubicaciones de entrega"
        )

    location.sales_channel = data.sales_channel
    location.region_id = data.region_id

    await db.commit()

    return location
