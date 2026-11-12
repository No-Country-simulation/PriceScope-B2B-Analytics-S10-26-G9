"""Inflation dashboard: a daily price index by category, compared with the dollar.

The index of a category is chain-linked (Jevons): each day it moves by the geometric
mean of the day-on-day change of its listings.

- Regular price, not the promo price, so a temporary discount is not deflation.
- Per gram, milliliter or unit when both days publish the same unit, so shrinkflation
  counts as a rise.
- A listing keeps its last price for up to STALE_DAYS days (a scraper can skip a day);
  after that it leaves the index until it shows up again. Products that appear later
  join without moving the index.
- Day-on-day changes above ×3 or below ÷3 are taken as scraping errors and skipped.

The overall index is the average of the category indices weighted by products.
Everything is computed per request from `prices`; if it gets slow with a bigger
catalog, read the daily prices from a TimescaleDB continuous aggregate instead.
"""

import math
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CanonicalProduct, Listing, Price, ProductCategory, RateType, User
from app.schemas.dashboard import (
    DashboardOptions,
    DashboardOutput,
    DashboardPeak,
    DashboardPoint,
    DashboardRow,
    DashboardScatterPoint,
    DashboardStore,
    DashboardSummary,
)
from app.schemas.products import Rate
from app.services.rates import BUSINESS_TIME_ZONE, rate_history
from app.services.stores import visible_stores

STALE_DAYS = 7
MAX_DAILY_CHANGE = 3.0
PEAK_DAYS = 7
PEAK_THRESHOLD = 3.0


@dataclass(frozen=True)
class _Observation:
    regular: float
    grammage: float | None
    unit: str | None


def _change(before: _Observation, after: _Observation) -> float | None:
    """after / before, per unit of content when both publish it in the same unit."""
    if before.grammage and after.grammage and before.unit and before.unit == after.unit:
        ratio = (after.regular / after.grammage) / (before.regular / before.grammage)
    else:
        ratio = after.regular / before.regular
    if not 1 / MAX_DAILY_CHANGE <= ratio <= MAX_DAILY_CHANGE:
        return None
    return ratio


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=n) for n in range((end - start).days + 1)]


def _pct(after: float, before: float) -> float:
    return round((after / before - 1) * 100, 2)


local_day = cast(func.timezone(BUSINESS_TIME_ZONE, Price.captured_at), Date)


def _utc_window(start: date, end: date) -> tuple:
    """Wide UTC window (± 1 day) so the index on captured_at is used; then cut by local day."""
    return (
        Price.captured_at >= datetime.combine(start - timedelta(days=1), time.min, UTC),
        Price.captured_at < datetime.combine(end + timedelta(days=2), time.min, UTC),
    )


async def _store_ids(db: AsyncSession, user: User, slugs: list[str] | None) -> list[uuid.UUID]:
    stores = await visible_stores(db, user)
    return [s.id for s in stores if slugs is None or s.slug in slugs]


async def dashboard_options(db: AsyncSession, user: User) -> DashboardOptions:
    stores = await visible_stores(db, user)
    store_ids = [s.id for s in stores]
    categories: list[ProductCategory] = []
    first = last = None
    if store_ids:
        in_stores = (
            select(Listing.canonical_product_id)
            .where(Listing.store_id.in_(store_ids))
            .scalar_subquery()
        )
        found = set(
            await db.scalars(
                select(CanonicalProduct.category)
                .distinct()
                .where(CanonicalProduct.id.in_(in_stores), CanonicalProduct.category.is_not(None))
            )
        )
        categories = [c for c in ProductCategory if c in found]
        first, last = (
            await db.execute(
                select(func.min(Price.captured_at), func.max(Price.captured_at))
                .join(Listing, Listing.id == Price.listing_id)
                .where(Listing.store_id.in_(store_ids), Price.location_id.is_(None))
            )
        ).one()

    def local(moment: datetime | None) -> date | None:
        if moment is None:
            return None
        return moment.astimezone(ZoneInfo(BUSINESS_TIME_ZONE)).date()

    return DashboardOptions(
        stores=[DashboardStore(slug=s.slug, name=s.name) for s in stores],
        categories=categories,
        min_date=local(first),
        max_date=local(last),
    )


async def _observations(
    db: AsyncSession,
    store_ids: list[uuid.UUID],
    categories: list[ProductCategory],
    start: date,
    end: date,
) -> tuple[dict[uuid.UUID, tuple[ProductCategory, uuid.UUID]], dict[uuid.UUID, dict]]:
    """Last national price of each listing on each local day, from start − STALE_DAYS."""
    rows = await db.execute(
        select(
            Price.listing_id,
            CanonicalProduct.id.label("product_id"),
            CanonicalProduct.category,
            local_day.label("day"),
            func.coalesce(Price.regular_price, Price.local_price).label("regular"),
            Price.grammage,
            Price.unit,
        )
        .join(Listing, Listing.id == Price.listing_id)
        .join(CanonicalProduct, CanonicalProduct.id == Listing.canonical_product_id)
        .where(
            Listing.store_id.in_(store_ids),
            CanonicalProduct.category.in_(categories),
            Price.location_id.is_(None),
            *_utc_window(start - timedelta(days=STALE_DAYS), end),
            local_day.between(start - timedelta(days=STALE_DAYS), end),
        )
        .ext(distinct_on(Price.listing_id, local_day))
        .order_by(Price.listing_id, local_day, Price.captured_at.desc())
    )
    owner: dict[uuid.UUID, tuple[ProductCategory, uuid.UUID]] = {}
    by_listing: dict[uuid.UUID, dict[date, _Observation]] = defaultdict(dict)
    for row in rows:
        if not row.regular or row.regular <= 0:
            continue
        owner[row.listing_id] = (row.category, row.product_id)
        by_listing[row.listing_id][row.day] = _Observation(
            regular=float(row.regular),
            grammage=float(row.grammage) if row.grammage else None,
            unit=row.unit,
        )
    return owner, by_listing


def _daily_rates(points: list[tuple[date, Decimal]], days: list[date]) -> dict[date, float] | None:
    """Rate of each day: the last quote on or before it (the first one for earlier days)."""
    if not points:
        return None
    quotes = {day: float(sell) for day, sell in points}
    current = float(points[0][1])
    rates = {}
    for day in days:
        current = quotes.get(day, current)
        rates[day] = current
    return rates


async def get_dashboard(
    db: AsyncSession,
    user: User,
    *,
    start: date,
    end: date,
    stores: list[str] | None,
    categories: list[ProductCategory] | None,
    rate: Rate,
) -> DashboardOutput:
    empty = DashboardOutput(
        rate=rate, start=None, end=None, summary=None, series=[], scatter=[], peaks=[]
    )
    categories = categories or list(ProductCategory)
    store_ids = await _store_ids(db, user, stores)
    if not store_ids:
        return empty

    owner, by_listing = await _observations(db, store_ids, categories, start, end)

    # Day-on-day log changes of each category, and how many listings were compared.
    log_sum: dict[ProductCategory, dict[date, float]] = defaultdict(lambda: defaultdict(float))
    compared: dict[ProductCategory, dict[date, int]] = defaultdict(lambda: defaultdict(int))
    products: dict[ProductCategory, set[uuid.UUID]] = defaultdict(set)
    first_day = last_day = None
    for listing_id, observed in by_listing.items():
        category, product_id = owner[listing_id]
        previous: _Observation | None = None
        seen: date | None = None
        for day in _days(start - timedelta(days=STALE_DAYS), end):
            today = observed.get(day)
            if today is not None:
                seen = day
            # Carried price: valid for STALE_DAYS after the last observation.
            current = today or (
                previous if seen is not None and (day - seen).days <= STALE_DAYS else None
            )
            if day >= start and current is not None:
                first_day = day if first_day is None else min(first_day, day)
                if today is not None:
                    last_day = day if last_day is None else max(last_day, day)
                    products[category].add(product_id)
                if day > start and previous is not None:
                    ratio = 1.0 if today is None else _change(previous, today)
                    if ratio is not None:
                        log_sum[category][day] += math.log(ratio)
                        compared[category][day] += 1
            previous = current

    if first_day is None or last_day is None or first_day >= last_day:
        return empty

    days = _days(first_day, last_day)
    present = [c for c in categories if products[c]]
    index: dict[ProductCategory, dict[date, float]] = {}
    for category in present:
        value = 100.0
        index[category] = {}
        for day in days:
            if day > first_day and compared[category][day]:
                value *= math.exp(log_sum[category][day] / compared[category][day])
            index[category][day] = value

    weight = {c: len(products[c]) for c in present}
    total = sum(weight.values())
    overall = {day: sum(index[c][day] * weight[c] for c in present) / total for day in days}

    rate_type = RateType.OFFICIAL if rate == "official" else RateType.BLUE
    rates = _daily_rates(
        await rate_history(db, rate_type, first_day - timedelta(days=STALE_DAYS), last_day),
        days,
    )
    rate_from = rates[first_day] if rates else None
    rate_to = rates[last_day] if rates else None
    devaluation = _pct(rate_to, rate_from) if rate_from and rate_to else None

    def versus_dollar(ars: float) -> tuple[float | None, float | None]:
        if devaluation is None or not rate_from or not rate_to:
            return None, None
        usd = round(((1 + ars / 100) / (rate_to / rate_from) - 1) * 100, 2)
        return usd, round(ars - devaluation, 2)

    rows = []
    for category in present:
        ars = _pct(index[category][last_day], 100)
        usd, gap = versus_dollar(ars)
        rows.append(
            DashboardRow(category=category, products=weight[category], ars=ars, usd=usd, gap=gap)
        )
    rows.sort(key=lambda r: r.gap if r.gap is not None else r.ars, reverse=True)

    ars = _pct(overall[last_day], 100)
    usd, gap = versus_dollar(ars)
    summary = DashboardSummary(
        days=(last_day - first_day).days,
        products=total,
        ars=ars,
        usd=usd,
        devaluation=devaluation,
        gap=gap,
        rate_from=rate_from,
        rate_to=rate_to,
        rows=rows,
    )

    series = [
        DashboardPoint(
            date=day,
            ars=round(overall[day], 3),
            usd=round(overall[day] * rate_from / rates[day], 3) if rates and rate_from else None,
            rate=rates[day] if rates else None,
            categories={c.value: round(index[c][day], 3) for c in present},
        )
        for day in days
    ]

    # One point per category and month; the months at both ends can be partial.
    scatter = []
    if rates:
        cursor = first_day
        while cursor < last_day:
            following = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)
            following = min(following, last_day)
            for category in present:
                scatter.append(
                    DashboardScatterPoint(
                        category=category,
                        month=cursor.strftime("%Y-%m"),
                        price=_pct(index[category][following], index[category][cursor]),
                        fx=_pct(rates[following], rates[cursor]),
                    )
                )
            cursor = following

    peaks = []
    for category in present:
        best: tuple[float, date] | None = None
        for day in days[1:]:
            before = max(first_day, day - timedelta(days=PEAK_DAYS))
            rise = _pct(index[category][day], index[category][before])
            if best is None or rise > best[0]:
                best = (rise, day)
        if best is not None and best[0] > PEAK_THRESHOLD:
            peaks.append(DashboardPeak(category=category, date=best[1], value=best[0]))
    peaks.sort(key=lambda p: p.value, reverse=True)

    return DashboardOutput(
        rate=rate,
        start=first_day,
        end=last_day,
        summary=summary,
        series=series,
        scatter=scatter,
        peaks=peaks,
    )
