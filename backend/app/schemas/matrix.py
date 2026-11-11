import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Page

Currency = Literal["ars", "usd"]
Rate = Literal["official", "blue"]


class MatrixStoreOutput(BaseModel):
    slug: str
    name: str


class MatrixCellOutput(BaseModel):
    store_slug: str
    price: Decimal | None
    regular_price: Decimal | None
    is_promo: bool
    available: bool
    captured_at: datetime


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
    prices: list[MatrixCellOutput]
    spread: MatrixSpreadOutput | None
    has_promotion: bool
    shrinkflation: bool = Field(
        default=False,
        description="Always false until scrapers extract grammage (net content).",
    )


class MatrixOutput(Page[MatrixRowOutput]):
    currency: Currency
    rate: Rate | None
    stores: list[MatrixStoreOutput]
