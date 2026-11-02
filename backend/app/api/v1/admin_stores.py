"""Administrative store and location endpoints."""

import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, require_admin
from app.schemas.store_locations import (
    StoreLocationCreate,
    StoreLocationOutput,
    StoreLocationRegionalContextInput,
)
from app.schemas.stores import StoreOutput
from app.services import store_locations, stores

router = APIRouter(
    prefix="/admin/stores",
    tags=["admin · stores"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[StoreOutput])
async def list_catalog(
    db: DbSession,
) -> list[StoreOutput]:
    return [StoreOutput.model_validate(store) for store in await stores.list_catalog(db)]


@router.get(
    "/{store_slug}/locations",
    response_model=list[StoreLocationOutput],
    summary="List locations for a store",
)
async def list_locations(
    store_slug: str,
    db: DbSession,
) -> list[StoreLocationOutput]:
    locations = await store_locations.list_store_locations(
        db,
        store_slug,
    )

    return [StoreLocationOutput.model_validate(location) for location in locations]


@router.post(
    "/{store_slug}/locations",
    response_model=StoreLocationOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a store location",
)
async def create_location(
    store_slug: str,
    data: StoreLocationCreate,
    db: DbSession,
) -> StoreLocationOutput:
    location = await store_locations.create_store_location(
        db,
        store_slug,
        data,
    )

    return StoreLocationOutput.model_validate(location)


@router.patch(
    "/{store_slug}/locations/{location_id}/regional-context",
    response_model=StoreLocationOutput,
    summary="Configure a location regional context",
)
async def update_regional_context(
    store_slug: str,
    location_id: uuid.UUID,
    data: StoreLocationRegionalContextInput,
    db: DbSession,
) -> StoreLocationOutput:
    location = await store_locations.configure_regional_context(
        db,
        store_slug,
        location_id,
        data,
    )

    return StoreLocationOutput.model_validate(location)
