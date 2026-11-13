"""Admin curation screen: listings without a canonical product and the catalog."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentAdmin, DbSession
from app.models import MatchStatus, ProductCategory
from app.schemas.curation import (
    CanonicalInput,
    CanonicalOutput,
    ChooseInput,
    CurationEventOutput,
    MergeInput,
    QueueOutput,
)
from app.services import curation

router = APIRouter(
    prefix="/admin/curation",
    tags=["admin · curation"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not an administrator"},
    },
)

_DECISION = {
    404: {"description": "Not in the queue"},
    409: {"description": "No longer pending"},
}


@router.get("/queue", response_model=QueueOutput, summary="Pending listings")
async def queue(
    db: DbSession,
    _admin: CurrentAdmin,
    store: Annotated[str | None, Query(description="Store slug.", max_length=60)] = None,
    category: ProductCategory | None = None,
) -> QueueOutput:
    return await curation.queue(db, store_slug=store, category=category)


@router.post(
    "/queue/{match_id}/confirm",
    response_model=CurationEventOutput,
    summary="Link the listing to the suggested product",
    responses=_DECISION,
)
async def confirm(db: DbSession, admin: CurrentAdmin, match_id: uuid.UUID) -> CurationEventOutput:
    return await curation.decide(db, admin, match_id, MatchStatus.CONFIRMED)


@router.post(
    "/queue/{match_id}/separate",
    response_model=CurationEventOutput,
    summary="Reject the suggestion: the listing stays unlinked",
    responses=_DECISION,
)
async def separate(db: DbSession, admin: CurrentAdmin, match_id: uuid.UUID) -> CurationEventOutput:
    return await curation.decide(db, admin, match_id, MatchStatus.SEPARATED)


@router.post(
    "/queue/{match_id}/choose",
    response_model=CurationEventOutput,
    summary="Propose another existing product (stays pending)",
    responses=_DECISION,
)
async def choose(
    db: DbSession, admin: CurrentAdmin, match_id: uuid.UUID, body: ChooseInput
) -> CurationEventOutput:
    return await curation.choose(db, admin, match_id, body.canonical_id)


@router.post(
    "/queue/{match_id}/create",
    response_model=CurationEventOutput,
    summary="Create a canonical product and propose it (stays pending)",
    responses={**_DECISION, 409: {"description": "No longer pending, or the EAN exists"}},
)
async def create(
    db: DbSession, admin: CurrentAdmin, match_id: uuid.UUID, body: CanonicalInput
) -> CurationEventOutput:
    return await curation.create(db, admin, match_id, body)


@router.get("/canonical", response_model=list[CanonicalOutput], summary="Search the catalog")
async def search_canonical(
    db: DbSession,
    _admin: CurrentAdmin,
    q: Annotated[str | None, Query(max_length=120)] = None,
    exclude: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[CanonicalOutput]:
    return await curation.search_canonical(db, q=q, exclude=exclude, limit=limit)


@router.post(
    "/canonical/merge",
    response_model=CurationEventOutput,
    summary="Merge a duplicate into another product and delete it",
    responses={400: {"description": "Same product"}, 404: {"description": "Product not found"}},
)
async def merge(db: DbSession, admin: CurrentAdmin, body: MergeInput) -> CurationEventOutput:
    return await curation.merge(db, admin, body.source_id, body.target_id)


@router.get("/history", response_model=list[CurationEventOutput], summary="Changes, newest first")
async def history(
    db: DbSession,
    _admin: CurrentAdmin,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[CurationEventOutput]:
    return await curation.history(db, limit=limit)


@router.post(
    "/history/{event_id}/revert",
    response_model=CurationEventOutput,
    summary="Undo the latest change not reverted yet",
    responses={
        404: {"description": "Change not found"},
        409: {"description": "Not the latest change, or the data changed since"},
    },
)
async def revert(db: DbSession, admin: CurrentAdmin, event_id: uuid.UUID) -> CurationEventOutput:
    return await curation.revert(db, admin, event_id)
