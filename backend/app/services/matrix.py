"""Price matrix: latest price of each canonical product in each visible store.

Spread, 30-day variation and shrinkflation are computed for every visible product,
then search, filters, sort and pagination are applied, because the client can sort
and filter by those computed values. Fine for the current catalog (a few thousand
products); if it grows, move the variation to a TimescaleDB continuous aggregate.
"""

import unicodedata
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import CanonicalProduct, Listing, Price, ProductCategory, Store, User
from app.schemas.matrix import (
    Currency,
    MatrixCellOutput,
    MatrixOutput,
    MatrixRowOutput,
    MatrixSpreadOutput,
    MatrixStoreOutput,
    MatrixSummaryOutput,
    Rate,
    ShrinkflationOutput,
    Signal,
    Sort,
)
from app.services.catalog import content_label
from app.services.stores import visible_store_ids

CENTS = Decimal("0.01")
VARIATION_DAYS = 30
SHRINKFLATION_DAYS = 90


def _fold(text: str) -> str:
    """Lowercase without accents, for search."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def _regular_in_currency(
    price: Decimal | None, local_price: Decimal, regular_price: Decimal | None
) -> Decimal | None:
    """Regular price in the selected currency, scaled like the current price."""
    if price is None or regular_price is None or not local_price:
        return None
    return (price * regular_price / local_price).quantize(CENTS)


def _spread(cells: list[MatrixCellOutput]) -> MatrixSpreadOutput | None:
    """Gap between the cheapest and the most expensive available offer."""
    offers = [c for c in cells if c.price is not None and c.available]
    if len(offers) < 2:
        return None

    cheapest = min(offers, key=lambda c: (c.price, c.store_slug))
    expensive = max(offers, key=lambda c: (c.price, c.store_slug))
    if cheapest.price <= 0:
        return None

    difference = expensive.price - cheapest.price
    tie = difference == 0
    return MatrixSpreadOutput(
        cheapest_store_slug=None if tie else cheapest.store_slug,
        cheapest_price=cheapest.price,
        most_expensive_store_slug=None if tie else expensive.store_slug,
        most_expensive_price=expensive.price,
        difference=difference,
        percentage=(difference / cheapest.price * 100).quantize(CENTS),
    )


@dataclass
class _Latest:
    listing_id: uuid.UUID
    product_id: uuid.UUID
    store_slug: str
    local_price: Decimal
    usd_official: Decimal | None
    usd_blue: Decimal | None
    regular_price: Decimal | None
    is_promo: bool
    available: bool
    captured_at: datetime
    grammage: Decimal | None
    unit: str | None


async def _latest_prices(
    db: AsyncSession, store_ids: list[uuid.UUID], min_stores: int
) -> list[_Latest]:
    """Latest national price (no branch) of every linked listing in the visible stores."""
    comparable = (
        select(Listing.canonical_product_id)
        .where(Listing.store_id.in_(store_ids), Listing.canonical_product_id.is_not(None))
        .group_by(Listing.canonical_product_id)
        .having(func.count(func.distinct(Listing.store_id)) >= min_stores)
    )
    latest = (
        select(Price)
        .ext(distinct_on(Price.listing_id))
        .join(Listing, Listing.id == Price.listing_id)
        .where(
            Price.location_id.is_(None),
            Listing.store_id.in_(store_ids),
            Listing.canonical_product_id.in_(comparable),
        )
        .order_by(Price.listing_id, Price.captured_at.desc())
        .subquery()
    )
    last = aliased(Price, latest)
    rows = await db.execute(
        select(
            last.listing_id,
            Listing.canonical_product_id,
            Store.slug,
            last.local_price,
            last.price_usd_official,
            last.price_usd_blue,
            last.regular_price,
            last.is_promo,
            last.available,
            last.captured_at,
            last.grammage,
            last.unit,
        )
        .join(Listing, Listing.id == last.listing_id)
        .join(Store, Store.id == Listing.store_id)
    )
    return [_Latest(*row) for row in rows]


async def _regular_prices_at(
    db: AsyncSession, listing_ids: list[uuid.UUID], cutoff: datetime
) -> dict[uuid.UUID, Decimal]:
    """Regular price (no promo) of each listing at the cutoff: its last capture before it."""
    if not listing_ids:
        return {}
    rows = await db.execute(
        select(Price.listing_id, func.coalesce(Price.regular_price, Price.local_price))
        .ext(distinct_on(Price.listing_id))
        .where(
            Price.listing_id.in_(listing_ids),
            Price.location_id.is_(None),
            Price.captured_at <= cutoff,
        )
        .order_by(Price.listing_id, Price.captured_at.desc())
    )
    return {listing_id: price for listing_id, price in rows}


async def _shrinkflation(
    db: AsyncSession, listing_ids: list[uuid.UUID], since: datetime
) -> dict[uuid.UUID, ShrinkflationOutput]:
    """Listings whose current net content is smaller than a previous one since `since`."""
    if not listing_ids:
        return {}
    rows = await db.execute(
        select(
            Price.listing_id,
            Price.grammage,
            Price.unit,
            func.min(Price.captured_at),
            func.max(Price.captured_at),
        )
        .where(
            Price.listing_id.in_(listing_ids),
            Price.location_id.is_(None),
            Price.captured_at >= since,
            Price.grammage.is_not(None),
        )
        .group_by(Price.listing_id, Price.grammage, Price.unit)
    )
    by_listing: dict[uuid.UUID, list[tuple[Decimal, str | None, datetime, datetime]]] = defaultdict(
        list
    )
    for listing_id, grammage, unit, first, last in rows:
        by_listing[listing_id].append((grammage, unit, first, last))

    result = {}
    for listing_id, groups in by_listing.items():
        current = max(groups, key=lambda g: g[3])
        previous = [
            g for g in groups if g[1] == current[1] and g[0] > current[0] and g[3] < current[2]
        ]
        if not previous:
            continue
        before = max(previous, key=lambda g: g[3])
        before_label = content_label(before[0], before[1])
        after_label = content_label(current[0], current[1])
        if before_label and after_label:
            result[listing_id] = ShrinkflationOutput(
                before=before_label, after=after_label, changed_at=current[2]
            )
    return result


def _matches(row: MatrixRowOutput, needle: str) -> bool:
    haystack = " ".join(filter(None, [row.name, row.brand, row.ean]))
    return needle in _fold(haystack)


def _sort_key(sort: Sort):
    if sort == "spread":
        return lambda r: (r.spread is None, -(r.spread.percentage if r.spread else 0), r.name)
    if sort == "variation":
        return lambda r: (r.variation_30d is None, -(r.variation_30d or 0), r.name)
    return lambda r: (_fold(r.name), str(r.product_id))


async def get_matrix(
    db: AsyncSession,
    user: User,
    *,
    currency: Currency,
    rate: Rate,
    q: str | None,
    min_stores: int,
    page: int,
    size: int,
    category: ProductCategory | None = None,
    signal: Signal | None = None,
    sort: Sort = "name",
    now: datetime | None = None,
) -> MatrixOutput:
    now = now or datetime.now(UTC)
    store_ids = await visible_store_ids(db, user)
    effective_rate = rate if currency == "usd" else None

    stores = (
        list(
            await db.scalars(
                select(Store)
                .where(Store.id.in_(store_ids), Store.active.is_(True))
                .order_by(Store.name)
            )
        )
        if store_ids
        else []
    )
    output = MatrixOutput(
        items=[],
        total=0,
        page=page,
        size=size,
        currency=currency,
        rate=effective_rate,
        stores=[MatrixStoreOutput(slug=s.slug, name=s.name) for s in stores],
        summary=MatrixSummaryOutput(
            products=0, average_spread=None, with_promotion=0, with_shrinkflation=0
        ),
    )
    if not stores:
        return output

    latest = await _latest_prices(db, [s.id for s in stores], min_stores)
    if not latest:
        return output

    listing_ids = [p.listing_id for p in latest]
    old_prices = await _regular_prices_at(db, listing_ids, now - timedelta(days=VARIATION_DAYS))
    shrinks = await _shrinkflation(db, listing_ids, now - timedelta(days=SHRINKFLATION_DAYS))

    # One cell per (product, store): the cheapest listing. Variations of every listing.
    cells: dict[tuple[uuid.UUID, str], MatrixCellOutput] = {}
    variations: dict[uuid.UUID, list[Decimal]] = defaultdict(list)
    for p in latest:
        usd = p.usd_official if rate == "official" else p.usd_blue
        price = p.local_price if currency == "ars" else usd

        old = old_prices.get(p.listing_id)
        current_regular = p.regular_price or p.local_price
        if old:
            variations[p.product_id].append((current_regular / old - 1) * 100)

        key = (p.product_id, p.store_slug)
        current = cells.get(key)
        if current is None or (
            price is not None and (current.price is None or price < current.price)
        ):
            cells[key] = MatrixCellOutput(
                store_slug=p.store_slug,
                price=price,
                regular_price=_regular_in_currency(price, p.local_price, p.regular_price),
                local_price=p.local_price,
                usd_price=usd,
                is_promo=p.is_promo,
                available=p.available,
                captured_at=p.captured_at,
                content=content_label(p.grammage, p.unit),
                shrinkflation=shrinks.get(p.listing_id),
            )

    by_product: dict[uuid.UUID, list[MatrixCellOutput]] = defaultdict(list)
    for (product_id, _), cell in cells.items():
        by_product[product_id].append(cell)

    details = {
        p.id: p
        for p in await db.scalars(
            select(CanonicalProduct).where(CanonicalProduct.id.in_(list(by_product)))
        )
    }

    rows = []
    for product_id, product_cells in by_product.items():
        product = details[product_id]
        product_cells.sort(key=lambda c: c.store_slug)
        changes = variations.get(product_id)
        rows.append(
            MatrixRowOutput(
                product_id=product_id,
                ean=product.ean,
                name=product.name,
                category=product.category,
                brand=product.brand,
                content=product.content,
                prices=product_cells,
                spread=_spread(product_cells),
                variation_30d=(sum(changes) / len(changes)).quantize(CENTS) if changes else None,
                has_promotion=any(c.is_promo for c in product_cells),
                shrinkflation=any(c.shrinkflation for c in product_cells),
            )
        )

    spreads = [r.spread.percentage for r in rows if r.spread]
    output.summary = MatrixSummaryOutput(
        products=len(rows),
        average_spread=(sum(spreads) / len(spreads)).quantize(CENTS) if spreads else None,
        with_promotion=sum(r.has_promotion for r in rows),
        with_shrinkflation=sum(r.shrinkflation for r in rows),
    )

    if q:
        needle = _fold(q.strip())
        rows = [r for r in rows if _matches(r, needle)]
    if category:
        rows = [r for r in rows if r.category == category]
    if signal == "promo":
        rows = [r for r in rows if r.has_promotion]
    elif signal == "shrinkflation":
        rows = [r for r in rows if r.shrinkflation]

    rows.sort(key=_sort_key(sort))
    output.total = len(rows)
    output.items = rows[(page - 1) * size : page * size]
    return output
