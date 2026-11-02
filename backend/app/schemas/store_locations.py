"""Schemas for store branches and delivery contexts."""

import uuid
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

FulfillmentMode = Literal["pickup", "delivery"]


class StoreLocationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        examples=["centro-retiro"],
    )

    name: str = Field(
        min_length=2,
        max_length=120,
        examples=["Sucursal Centro"],
    )

    city: str | None = Field(
        default=None,
        max_length=100,
    )

    province: str | None = Field(
        default=None,
        max_length=100,
    )

    postal_code: str | None = Field(
        default=None,
        max_length=20,
    )

    fulfillment_mode: FulfillmentMode

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()

        if len(name) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")

        return name


class StoreLocationOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    store_id: uuid.UUID
    code: str
    name: str

    city: str | None
    province: str | None
    postal_code: str | None

    fulfillment_mode: FulfillmentMode

    external_reference: str | None
    region_id: str | None
    sales_channel: str | None

    active: bool


class StoreLocationRegionalContextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sales_channel: str = Field(
        min_length=1,
        max_length=20,
        pattern=r"^[1-9][0-9]*$",
        examples=["1"],
    )

    region_id: str = Field(
        min_length=1,
        max_length=150,
        examples=["region-de-prueba"],
    )

    @field_validator("region_id")
    @classmethod
    def validate_region_id(cls, value: str) -> str:
        region = value.strip()

        if not region or any(ord(character) < 32 for character in region):
            raise ValueError("region_id no es válido")

        return region
