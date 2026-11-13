import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, false, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import CurationAction, MatchStatus
from app.models.mixins import WithId, WithTimestamps, enum_column


class ListingMatch(WithId, WithTimestamps, Base):
    """Curation queue entry: a listing without a canonical product and the suggested one."""

    __tablename__ = "listing_matches"
    __table_args__ = (Index("ix_listing_matches_status", "status"),)

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), unique=True
    )
    suggested_canonical_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("canonical_products.id", ondelete="SET NULL"), index=True
    )
    # 0–1, None without a suggestion. Kept when an admin proposes another product.
    score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    status: Mapped[MatchStatus] = mapped_column(
        enum_column(MatchStatus, "match_status"), default=MatchStatus.PENDING
    )
    # The suggestion was chosen or created by an admin, not computed.
    manual: Mapped[bool] = mapped_column(default=False, server_default=false())
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CurationEvent(WithId, Base):
    """Auditable history of curation changes. `payload` holds what is needed to revert."""

    __tablename__ = "curation_events"
    __table_args__ = (Index("ix_curation_events_created_at", "created_at"),)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[CurationAction] = mapped_column(enum_column(CurationAction, "curation_action"))
    before: Mapped[str] = mapped_column(Text)
    after: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reverted_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # Not a relationship: just the label for the history table.
    admin_name: Mapped[str] = mapped_column(String(120))
    reverted_by_name: Mapped[str | None] = mapped_column(String(120))
