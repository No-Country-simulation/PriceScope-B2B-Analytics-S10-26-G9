import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import ProductCategory
from app.schemas.products import (
    HISTORY_DAYS,
    ProductDetailOutput,
    ProductHistoryOutput,
    ProductSummaryOutput,
    Rate,
)
from app.services import products

router = APIRouter(
    prefix="/products",
    tags=["products"],
    responses={401: {"description": "Not authenticated"}},
)

NOT_VISIBLE = {404: {"description": "The product does not exist or is not in the user's stores"}}


@router.get("", response_model=list[ProductSummaryOutput], summary="Search products")
async def search(
    db: DbSession,
    user: CurrentUser,
    q: Annotated[str | None, Query(min_length=2, max_length=60)] = None,
    category: ProductCategory | None = None,
    exclude: Annotated[uuid.UUID | None, Query(description="Leave this product out.")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[ProductSummaryOutput]:
    return await products.search_products(
        db, user, q=q, category=category, exclude=exclude, limit=limit
    )


@router.get(
    "/{product_id}",
    response_model=ProductDetailOutput,
    summary="Product with its latest price in each store",
    responses=NOT_VISIBLE,
)
async def detail(db: DbSession, user: CurrentUser, product_id: uuid.UUID) -> ProductDetailOutput:
    return await products.get_product(db, user, product_id)


@router.get(
    "/{product_id}/history",
    response_model=ProductHistoryOutput,
    summary="Daily price of the product in each store",
    responses=NOT_VISIBLE | {422: {"description": "Invalid period"}},
)
async def history(
    db: DbSession,
    user: CurrentUser,
    product_id: uuid.UUID,
    days: Annotated[int, Query(description="30, 90, 180 or 365.")] = 90,
    rate: Rate = "blue",
) -> ProductHistoryOutput:
    if days not in HISTORY_DAYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "days debe ser 30, 90, 180 o 365"
        )
    return await products.product_history(db, user, product_id, days=days, rate=rate)
