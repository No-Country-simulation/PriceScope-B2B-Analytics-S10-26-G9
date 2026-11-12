from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import RateType


class RateOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: str
    type: RateType
    buy: Decimal | None
    sell: Decimal
    quoted_at: datetime
    source_date: datetime | None


class QuoteOutput(BaseModel):
    """One rate as a client sees it."""

    model_config = ConfigDict(from_attributes=True)

    source: str
    buy: Decimal | None
    sell: Decimal
    quoted_at: datetime


class LatestRatesOutput(BaseModel):
    official: QuoteOutput | None
    blue: QuoteOutput | None
    gap_pct: Decimal | None = Field(
        description="How much the blue rate is above the official, in %."
    )


class RateHistoryPoint(BaseModel):
    date: date
    sell: Decimal
