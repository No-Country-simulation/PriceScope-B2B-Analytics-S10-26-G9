import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, false, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Price(Base):
    """Hypertable by captured_at. The PK includes the time column."""

    __tablename__ = "prices"

    __table_args__ = (
        Index(
            "ix_prices_location_captured_at",
            "location_id",
            "captured_at",
        ),
    )

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True
    )
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("store_locations.id", ondelete="RESTRICT"),
        nullable=True,
    )
    local_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    strikethrough_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    regular_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    is_promo: Mapped[bool] = mapped_column(default=False, server_default=false())
    available: Mapped[bool] = mapped_column(default=True, server_default=true())
    grammage: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    unit: Mapped[str | None] = mapped_column(String(10))
    # Snapshot of the rates in effect at capture time (no FK: it cannot point to a hypertable)
    fx_official: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    fx_blue: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    quoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    price_usd_official: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    price_usd_blue: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
