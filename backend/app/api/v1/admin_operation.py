"""Admin operation screen: scraper status, error log and manual runs."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentAdmin, DbSession, Queue
from app.schemas.operation import (
    ERROR_HOURS,
    EnqueueOutput,
    ErrorKind,
    OperationError,
    OperationOverview,
)
from app.services import operation

router = APIRouter(
    prefix="/admin/scraping",
    tags=["admin · scraping"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not an administrator"},
    },
)


@router.get(
    "/overview",
    response_model=OperationOverview,
    summary="State of each store's scraper and of the rate ingestion",
)
async def overview(db: DbSession, _admin: CurrentAdmin) -> OperationOverview:
    return await operation.overview(db)


@router.get(
    "/errors",
    response_model=list[OperationError],
    summary="Failed runs, newest first",
    responses={422: {"description": "Invalid period"}},
)
async def errors(
    db: DbSession,
    _admin: CurrentAdmin,
    hours: Annotated[int, Query(description="24, 72 or 168.")] = 72,
    store: Annotated[str | None, Query(description="Store slug.", max_length=60)] = None,
    kind: ErrorKind | None = None,
) -> list[OperationError]:
    if hours not in ERROR_HOURS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "hours debe ser 24, 72 o 168")
    return await operation.errors(db, hours=hours, store_slug=store, kind=kind)


@router.post(
    "/stores/{slug}/enqueue",
    response_model=EnqueueOutput,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue the store's daily scraping job now",
    responses={
        404: {"description": "Store not found or inactive"},
        409: {"description": "A run of this store is already in progress"},
        503: {"description": "Scheduled scraping is not enabled for the store"},
    },
)
async def enqueue(db: DbSession, _admin: CurrentAdmin, queue: Queue, slug: str) -> EnqueueOutput:
    return await operation.enqueue(db, queue, slug)
