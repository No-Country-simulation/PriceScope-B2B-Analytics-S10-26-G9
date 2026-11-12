from datetime import date

from pydantic import BaseModel, Field

from app.models import ProductCategory
from app.schemas.products import Rate

MAX_DASHBOARD_DAYS = 366


class DashboardRow(BaseModel):
    """Accumulated inflation of one category in the period."""

    category: ProductCategory
    products: int = Field(description="Canonical products with a price in the period.")
    ars: float = Field(description="Change of the ARS index, in %.")
    usd: float | None = Field(description="Change in USD at the selected rate, in %.")
    gap: float | None = Field(description="ars − devaluation, in percentage points.")


class DashboardSummary(BaseModel):
    days: int
    products: int
    ars: float
    usd: float | None
    devaluation: float | None = Field(description="rate_to / rate_from − 1, in %.")
    gap: float | None
    rate_from: float | None
    rate_to: float | None
    rows: list[DashboardRow] = Field(description="Sorted by gap, highest first.")


class DashboardPoint(BaseModel):
    date: date
    ars: float = Field(description="Overall index in ARS, base 100 on the first day.")
    usd: float | None = Field(description="Overall index in USD, base 100 on the first day.")
    rate: float | None = Field(description="Selected rate on that day (last quote, carried).")
    categories: dict[str, float] = Field(description="ARS index of each category, base 100.")


class DashboardScatterPoint(BaseModel):
    category: ProductCategory
    month: str = Field(description="YYYY-MM. The first and last months can be partial.")
    price: float = Field(description="Change of the category index in the month, in %.")
    fx: float = Field(description="Change of the rate in the month, in %.")


class DashboardPeak(BaseModel):
    category: ProductCategory
    date: date
    value: float = Field(description="Largest rise of the ARS index in up to 7 days, in %.")


class DashboardOutput(BaseModel):
    rate: Rate
    start: date | None = Field(description="First day with prices in the requested range.")
    end: date | None = Field(description="Last day with prices in the requested range.")
    summary: DashboardSummary | None = Field(description="null when there are no prices.")
    series: list[DashboardPoint]
    scatter: list[DashboardScatterPoint]
    peaks: list[DashboardPeak] = Field(description="Rises above 3 %, highest first.")


class DashboardStore(BaseModel):
    slug: str
    name: str


class DashboardOptions(BaseModel):
    stores: list[DashboardStore]
    categories: list[ProductCategory] = Field(description="Categories with products in them.")
    min_date: date | None
    max_date: date | None
