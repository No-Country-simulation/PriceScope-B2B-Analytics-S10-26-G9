import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import AlertRuleKind, AlertRuleScope, MilestoneKey, RateType
from app.models.mixins import WithId, WithTimestamps, enum_column


class AlertRule(WithId, WithTimestamps, Base):
    """What a user wants to be warned about. Evaluated daily by the worker."""

    __tablename__ = "alert_rules"
    __table_args__ = (
        CheckConstraint("threshold_pp >= 0", name="threshold_non_negative"),
        CheckConstraint("period_days IN (7, 30, 90)", name="period_days_valid"),
        CheckConstraint("starts_on <= ends_on", name="range_ordered"),
        CheckConstraint(
            "(scope = 'category' AND category IS NOT NULL AND canonical_product_id IS NULL) "
            "OR (scope = 'product' AND canonical_product_id IS NOT NULL AND category IS NULL)",
            name="scope_consistent",
        ),
        CheckConstraint(
            "(kind = 'devaluation' AND period_days IS NOT NULL) "
            "OR (kind = 'milestone' AND starts_on IS NOT NULL AND ends_on IS NOT NULL)",
            name="kind_consistent",
        ),
        Index("ix_alert_rules_user_active", "user_id", "active"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[AlertRuleKind] = mapped_column(enum_column(AlertRuleKind, "alert_rule_kind"))
    scope: Mapped[AlertRuleScope] = mapped_column(enum_column(AlertRuleScope, "alert_rule_scope"))
    category: Mapped[str | None] = mapped_column(String(160))
    canonical_product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("canonical_products.id", ondelete="CASCADE")
    )
    # None = any of the user's stores (resolved at evaluation time).
    store_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"))
    rate_type: Mapped[RateType] = mapped_column(enum_column(RateType, "rate_type"))
    threshold_pp: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    period_days: Mapped[int | None] = mapped_column(SmallInteger)
    milestone_key: Mapped[MilestoneKey | None] = mapped_column(
        enum_column(MilestoneKey, "milestone_key")
    )
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    notify_in_app: Mapped[bool] = mapped_column(default=True, server_default=true())
    notify_email: Mapped[bool] = mapped_column(default=False, server_default=false())
    active: Mapped[bool] = mapped_column(default=True, server_default=true())
    last_fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
