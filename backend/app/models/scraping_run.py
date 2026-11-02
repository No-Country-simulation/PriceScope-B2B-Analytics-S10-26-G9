"""Execution history for e-commerce scraping jobs."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import WithId


class ScrapingRun(WithId, Base):
    """Track the execution and outcome of a scraping job."""

    __tablename__ = "scraping_runs"

    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'success', 'failed')",
            name="scraping_run_status_valid",
        ),
        CheckConstraint(
            "products_received >= 0 AND observations_saved >= 0 AND skipped_duplicates >= 0",
            name="scraping_run_counts_non_negative",
        ),
        Index(
            "ix_scraping_runs_store_started_at",
            "store_id",
            "started_at",
        ),
    )

    store_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="RESTRICT"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(16),
        default="running",
        server_default="running",
        nullable=False,
    )

    search_mode: Mapped[str] = mapped_column(String(20))
    search_value: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    products_received: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
    )

    observations_saved: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
    )

    skipped_duplicates: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
    )

    error_code: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )
