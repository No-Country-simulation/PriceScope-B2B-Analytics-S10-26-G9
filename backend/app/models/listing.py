import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import WithId, WithTimestamps


class Listing(WithId, WithTimestamps, Base):
    """How a product appears in a store. One row per (store, store product code)."""

    __tablename__ = "listings"
    __table_args__ = (UniqueConstraint("store_id", "external_code"),)

    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="RESTRICT"), index=True
    )
    external_code: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(500))
    source_category: Mapped[str | None] = mapped_column(String(160))
    brand: Mapped[str | None] = mapped_column(String(120))
    canonical_product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("canonical_products.id", ondelete="SET NULL"), index=True
    )
