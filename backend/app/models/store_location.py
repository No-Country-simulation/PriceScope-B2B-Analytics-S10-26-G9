"""Store branches and delivery pricing contexts."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import WithId, WithTimestamps


class StoreLocation(WithId, WithTimestamps, Base):
    """A branch or delivery context belonging to a store."""

    __tablename__ = "store_locations"

    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "code",
            name="uq_store_locations_store_code",
        ),
        CheckConstraint(
            "fulfillment_mode IN ('pickup', 'delivery')",
            name="fulfillment_mode_valid",
        ),
    )

    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="RESTRICT"))

    # Stable identifier inside PriceScope.
    code: Mapped[str] = mapped_column(String(80))

    name: Mapped[str] = mapped_column(String(120))

    city: Mapped[str | None] = mapped_column(String(100))
    province: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))

    # pickup = retiro; delivery = envío.
    fulfillment_mode: Mapped[str] = mapped_column(String(10))

    # Provider-specific identifiers, to verify later.
    external_reference: Mapped[str | None] = mapped_column(String(120))
    region_id: Mapped[str | None] = mapped_column(String(150))
    sales_channel: Mapped[str | None] = mapped_column(String(20))

    active: Mapped[bool] = mapped_column(
        default=True,
        server_default=true(),
    )
