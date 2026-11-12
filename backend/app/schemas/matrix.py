import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models import ProductCategory
from app.schemas.common import Page, ShrinkflationOutput

Currency = Literal["ars", "usd"]
Rate = Literal["official", "blue"]
Signal = Literal["promo", "shrinkflation"]
Sort = Literal["name", "spread", "variation"]


class MatrixStoreOutput(BaseModel):
    slug: str
    name: str


class MatrixCellOutput(BaseModel):
    store_slug: str
    price: Decimal | None = Field(description="In the selected currency.")
    regular_price: Decimal | None
    local_price: Decimal = Field(description="Always in ARS.")
    usd_price: Decimal | None = Field(
        description="In USD at the selected rate, with the rate in effect at capture time."
    )
    is_promo: bool
    available: bool
    captured_at: datetime
    content: str | None = None
    shrinkflation: ShrinkflationOutput | None = None


class MatrixSpreadOutput(BaseModel):
    cheapest_store_slug: str | None
    cheapest_price: Decimal
    most_expensive_store_slug: str | None
    most_expensive_price: Decimal
    difference: Decimal
    percentage: Decimal


class MatrixRowOutput(BaseModel):
    product_id: uuid.UUID
    ean: str
    name: str
    category: ProductCategory | None = None
    brand: str | None = None
    content: str | None = None
    prices: list[MatrixCellOutput]
    spread: MatrixSpreadOutput | None
    variation_30d: Decimal | None = Field(
        default=None,
        description="Average change of the regular price (no promos) in the last 30 days, in %. "
        "Null when no store has a price from 30 days ago.",
    )
    has_promotion: bool
    shrinkflation: bool = False


class MatrixSummaryOutput(BaseModel):
    """KPIs over every product visible to the user, before search and filters."""

    products: int
    average_spread: Decimal | None
    with_promotion: int
    with_shrinkflation: int


class MatrixOutput(Page[MatrixRowOutput]):
    currency: Currency
    rate: Rate | None
    stores: list[MatrixStoreOutput]
    summary: MatrixSummaryOutput
