import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

RunStatus = Literal["running", "success", "failed"]
ErrorKind = Literal["timeout", "network", "block", "server", "markup", "interrupted", "other"]
Severity = Literal["error", "warning"]
ERROR_HOURS = (24, 72, 168)


class LastRun(BaseModel):
    id: uuid.UUID
    status: RunStatus
    started_at: datetime
    finished_at: datetime | None
    products_received: int
    observations_saved: int
    error_code: str | None


class TrendPoint(BaseModel):
    date: date
    products: int = Field(description="Prices saved by the best successful run of the day.")


class StoreOverview(BaseModel):
    store_slug: str
    store_name: str
    schedule: str | None = Field(
        description='"Diario 06:00" (Argentina), or null if not scheduled.'
    )
    next_run_at: datetime | None
    last_run: LastRun | None
    last_success_at: datetime | None
    expected: int | None = Field(
        description="Median of prices saved by the last 7 successful runs."
    )
    trend_7d: list[TrendPoint] = Field(description="From 6 days ago to today (Argentina).")
    can_enqueue: bool = Field(description="Scheduled jobs are enabled and approved for the store.")


class RatesStatus(BaseModel):
    last_quoted_at: datetime | None
    ok: bool = Field(description="A rate arrived in the last 2 hours.")
    source: str | None = Field(description="Source of the latest rate (dolarapi, bluelytics).")
    ingestions_24h: int = Field(description="Hourly ingestions in the last 24 hours (24 expected).")


class OperationOverview(BaseModel):
    stores: list[StoreOverview]
    rates: RatesStatus


class OperationError(BaseModel):
    id: uuid.UUID = Field(description="The failed run.")
    date: datetime
    store_slug: str
    store_name: str
    kind: ErrorKind
    severity: Severity = Field(description="warning when a later run of the store succeeded.")
    message: str
    detail: str


class EnqueueOutput(BaseModel):
    store_slug: str
    queued_at: datetime
