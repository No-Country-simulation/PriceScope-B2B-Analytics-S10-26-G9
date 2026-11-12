import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models import ProductCategory
from app.schemas.common import ShrinkflationOutput

Rate = Literal["official", "blue"]
HISTORY_DAYS = (30, 90, 180, 365)


class ProductSummaryOutput(BaseModel):
    """A canonical product as listed in searches and selectors."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    ean: str
    name: str
    brand: str | None
    content: str | None
    category: ProductCategory | None


class ProductStoreOutput(BaseModel):
    """Latest national price of the product in one store."""

    store_slug: str
    store_name: str
    url: str
    local_price: Decimal
    regular_price: Decimal
    is_promo: bool
    available: bool
    captured_at: datetime
    usd_official: Decimal | None
    usd_blue: Decimal | None
    content: str | None = Field(description="Net content published by this store today.")
    price_per_unit: Decimal | None = Field(
        description="ARS per gram, milliliter or unit, from the current price."
    )
    unit: str | None = Field(description='"g", "ml" or "u" for price_per_unit.')
    shrinkflation: ShrinkflationOutput | None = None


class ProductDetailOutput(ProductSummaryOutput):
    stores: list[ProductStoreOutput] = Field(
        description="Only stores visible to the user that publish the product."
    )


class ProductHistoryPoint(BaseModel):
    """Last national price of one store on one day (Argentina time)."""

    date: date
    store_slug: str
    price: Decimal
    regular_price: Decimal
    is_promo: bool
    content: str | None
    usd_price: Decimal | None = Field(description="Price in USD at the selected rate.")
    fx: Decimal | None = Field(description="Selected rate in effect when the price was captured.")
    quoted_at: datetime | None = Field(description="When that rate was quoted.")


class ProductHistoryOutput(BaseModel):
    rate: Rate
    start: date
    end: date
    stores: list[dict[str, str]] = Field(description="[{slug, name}] in display order.")
    points: list[ProductHistoryPoint]
