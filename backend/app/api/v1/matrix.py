from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.matrix import Currency, MatrixOutput, Rate
from app.services import matrix

router = APIRouter(prefix="/matrix", tags=["matrix"])


@router.get(
    "",
    response_model=MatrixOutput,
    summary="Price matrix by store",
    responses={401: {"description": "Not authenticated"}},
)
async def get_matrix(
    db: DbSession,
    user: CurrentUser,
    currency: Currency = "ars",
    rate: Rate = "official",
    q: Annotated[str | None, Query(min_length=2, max_length=60)] = None,
    min_stores: Annotated[int, Query(ge=1, le=10)] = 1,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> MatrixOutput:
    return await matrix.get_matrix(
        db,
        user,
        currency=currency,
        rate=rate,
        q=q,
        min_stores=min_stores,
        page=page,
        size=size,
    )
