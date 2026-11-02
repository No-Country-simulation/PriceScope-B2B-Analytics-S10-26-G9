import uuid
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class ScrapeRunInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "store_slug": "carrefour",
                    "category_ids": [123, 124],
                    "page_size": 10,
                    "max_pages": 1,
                }
            ]
        },
    )

    store_slug: str = Field(
        min_length=2,
        max_length=60,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )

    term: str | None = Field(
        default=None,
        min_length=2,
        max_length=60,
    )

    category_id: int | None = Field(
        default=None,
        ge=1,
        strict=True,
    )

    category_ids: list[Annotated[int, Field(ge=1, strict=True)]] | None = Field(
        default=None,
        min_length=1,
        max_length=2,
    )

    page_size: int = Field(default=10, ge=1, le=20)
    max_pages: int = Field(default=1, ge=1, le=2)

    @field_validator("term")
    @classmethod
    def validate_term(cls, value: str | None) -> str | None:
        if value is None:
            return None

        term = value.strip()

        if len(term) < 2:
            raise ValueError("El término debe tener al menos 2 caracteres")

        return term

    @model_validator(mode="after")
    def validate_search_mode(self) -> Self:
        modes = (
            self.term,
            self.category_id,
            self.category_ids,
        )

        if sum(value is not None for value in modes) != 1:
            raise ValueError("Indicá term, category_id o category_ids")

        if self.category_ids is not None:
            if len(set(self.category_ids)) != len(self.category_ids):
                raise ValueError("No se permiten categorías repetidas")

        return self


class ScrapeRunOutput(BaseModel):
    store: str
    products_received: int
    observations_saved: int
    skipped_duplicates: int


class ScrapeCategoryOutput(BaseModel):
    id: int
    name: str
    level: int
    path: str
    has_children: bool


class ScrapeCategoriesOutput(BaseModel):
    store: str
    total: int
    offset: int
    limit: int
    has_more: bool
    items: list[ScrapeCategoryOutput]


class ScrapeSellerOutput(BaseModel):
    seller_id: str
    seller_name: str
    sku_count: int
    priced_sku_count: int
    default_sku_count: int


class ScrapeSellerPreviewOutput(BaseModel):
    store: str
    products_received: int
    sellers: list[ScrapeSellerOutput]


class ScrapeStoreReadinessOutput(BaseModel):
    store_slug: str
    store_active: bool
    globally_enabled: bool
    individually_enabled: bool
    origin_matches: bool
    configured_seller_count: int
    technically_ready: bool
    issues: list[str]


class ScrapeRegionalProductOutput(BaseModel):
    product_id: str | None
    name: str


class ScrapeRegionalOfferOutput(BaseModel):
    product_id: str | None
    product_name: str
    sku_id: str
    seller_id: str
    seller_name: str
    current_price: Decimal | None
    list_price: Decimal | None


class ScrapeRegionalPreviewOutput(BaseModel):
    store: str
    location_id: uuid.UUID
    location_code: str
    sales_channel: str
    region_id: str
    products_received: int
    products: list[ScrapeRegionalProductOutput]
    sellers: list[ScrapeSellerOutput]
    offers: list[ScrapeRegionalOfferOutput]
    offers_truncated: bool
