import uuid

from pydantic import BaseModel, ConfigDict

from app.models import StoreCategory


class StoreOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    base_url: str
    category: StoreCategory
    active: bool


class ClientStoreOutput(BaseModel):
    """What a client needs to label a store. No scraping details."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    category: StoreCategory


class AssignStoreInput(BaseModel):
    store_id: uuid.UUID
