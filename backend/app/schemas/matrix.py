import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Page

Currency = Literal["ars", "usd"]
Rate = Literal["official", "blue"]


class MatrixStoreOutput(BaseModel):
    slug: str
    name: str


class MatrixCellOutput(BaseModel):
    store_slug: str
    price: Decimal | None
    available: bool
    captured_at: datetime


class MatrixRowOutput(BaseModel):
    product_id: uuid.UUID
    ean: str
    name: str
    prices: list[MatrixCellOutput]


class MatrixOutput(Page[MatrixRowOutput]):
    currency: Currency
    rate: Rate | None
    stores: list[MatrixStoreOutput]
