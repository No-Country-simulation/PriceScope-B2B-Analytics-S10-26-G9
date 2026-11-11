import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import WithId


class FiredAlert(WithId, Base):
    """One row each time a rule is met. Keeps a snapshot, so history survives rule edits."""

    __tablename__ = "fired_alerts"
    __table_args__ = (
        UniqueConstraint("rule_id", "evaluated_on"),
        Index("ix_fired_alerts_user_fired_at", "user_id", "fired_at"),
        Index("ix_fired_alerts_user_unseen", "user_id", postgresql_where=text("seen_at IS NULL")),
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alert_rules.id", ondelete="CASCADE"))
    # Copy of rule.user_id: the inbox filters by user without a JOIN.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    fired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    evaluated_on: Mapped[date] = mapped_column(Date)
    rule_name: Mapped[str] = mapped_column(String(80))
    scope_label: Mapped[str] = mapped_column(String(200))
    phrase: Mapped[str] = mapped_column(Text)
    devaluation_pct: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    average_pct: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    products_count: Mapped[int]
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FiredAlertItem(Base):
    """A listing that triggered a fired alert (the detail table)."""

    __tablename__ = "fired_alert_items"

    fired_alert_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fired_alerts.id", ondelete="CASCADE"), primary_key=True
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    canonical_product_id: Mapped[uuid.UUID | None] = mapped_column()
    product_name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(160))
    store_name: Mapped[str] = mapped_column(String(120))
    price_start: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    price_end: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    variation_pct: Mapped[Decimal] = mapped_column(Numeric(7, 2))
