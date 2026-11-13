import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models import CurationAction, ProductCategory


class CanonicalOutput(BaseModel):
    """A canonical product as shown in curation."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    ean: str | None
    name: str
    brand: str | None
    content: str | None
    category: ProductCategory | None


class SuggestedOutput(CanonicalOutput):
    price: Decimal | None = Field(
        description="Average of the latest price in each store where it is published."
    )


class QueueListingOutput(BaseModel):
    id: uuid.UUID
    name: str
    brand: str | None
    content: str | None = Field(description="Net content read from the name.")
    category: ProductCategory | None = Field(description="Client category of source_category.")
    source_category: str | None = Field(description="Category as the store publishes it.")
    external_code: str = Field(description="Product code in the store.")
    url: str
    price: Decimal | None = Field(description="Latest national price.")


class QueueStoreOutput(BaseModel):
    slug: str
    name: str


class QueueItemOutput(BaseModel):
    id: uuid.UUID
    store: QueueStoreOutput
    score: Decimal | None = Field(description="0–1. None without a suggestion.")
    manual: bool = Field(description="The suggestion was chosen or created by an admin.")
    created_at: datetime
    listing: QueueListingOutput
    suggested: SuggestedOutput | None


class QueueOutput(BaseModel):
    total: int = Field(description="Pending items before filters.")
    stores: list[QueueStoreOutput] = Field(description="Stores with pending items.")
    categories: list[ProductCategory] = Field(description="Categories with pending items.")
    uncategorized: bool = Field(description="Some pending item has no category.")
    items: list[QueueItemOutput] = Field(
        description="Manual suggestions first, then lowest score first."
    )


class ChooseInput(BaseModel):
    canonical_id: uuid.UUID


class CanonicalInput(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    brand: str | None = Field(default=None, max_length=120)
    content: str | None = Field(default=None, max_length=40)
    category: ProductCategory | None = None
    ean: str | None = Field(default=None, description="8 to 14 digits.")

    @field_validator("name", "brand", "content", "ean", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("ean")
    @classmethod
    def _digits(cls, value: str | None) -> str | None:
        if value is not None and not (value.isdigit() and 8 <= len(value) <= 14):
            raise ValueError("El EAN tiene que tener entre 8 y 14 dígitos")
        return value


class MergeInput(BaseModel):
    source_id: uuid.UUID = Field(description="The duplicate: it is deleted.")
    target_id: uuid.UUID = Field(description="The product that is kept.")


class RevertedOutput(BaseModel):
    at: datetime
    admin: str


class CurationEventOutput(BaseModel):
    id: uuid.UUID
    at: datetime
    admin: str
    action: CurationAction
    before: str
    after: str
    reverted: RevertedOutput | None
    revertible: bool = Field(description="It is the latest change not reverted yet.")
