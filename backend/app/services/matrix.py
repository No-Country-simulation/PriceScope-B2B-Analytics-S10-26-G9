"""Price matrix: latest price of each canonical product in each visible store."""

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import CanonicalProduct, Listing, Price, Store, User
from app.schemas.matrix import (
    Currency,
    MatrixCellOutput,
    MatrixOutput,
    MatrixRowOutput,
    MatrixSpreadOutput,
    MatrixStoreOutput,
    Rate,
)
from app.services.stores import visible_store_ids

CENTS = Decimal("0.01")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


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
) -> MatrixOutput:
    store_ids = await visible_store_ids(db, user)
    effective_rate = rate if currency == "usd" else None

    stores = list(
        await db.scalars(
            select(Store)
            .where(Store.id.in_(store_ids), Store.active.is_(True))
            .order_by(Store.name)
        )
    )
    empty = MatrixOutput(
        items=[],
        total=0,
        page=page,
        size=size,
        currency=currency,
        rate=effective_rate,
        stores=[MatrixStoreOutput(slug=s.slug, name=s.name) for s in stores],
    )
    if not stores:
        return empty

    # 1) Products to show on this page.
    filters = [Listing.store_id.in_(store_ids), Listing.canonical_product_id.is_not(None)]
    if q:
        filters.append(CanonicalProduct.name.ilike(f"%{_escape_like(q.strip())}%", escape="\\"))

    products = (
        select(CanonicalProduct.id)
        .join(Listing, Listing.canonical_product_id == CanonicalProduct.id)
        .where(*filters)
        .group_by(CanonicalProduct.id)
        .having(func.count(func.distinct(Listing.store_id)) >= min_stores)
    )
    total = await db.scalar(select(func.count()).select_from(products.subquery())) or 0
    if total == 0:
        return empty

    page_ids = list(
        await db.scalars(
            products.order_by(CanonicalProduct.name, CanonicalProduct.id)
            .offset((page - 1) * size)
            .limit(size)
        )
    )

    # 2) Latest national price (no branch) per listing.
    latest = (
        select(Price)
        .ext(distinct_on(Price.listing_id))
        .where(Price.location_id.is_(None))
        .order_by(Price.listing_id, Price.captured_at.desc())
        .subquery()
    )
    last = aliased(Price, latest)

    rows = await db.execute(
        select(
            Listing.canonical_product_id,
            Store.slug,
            last.local_price,
            last.price_usd_official,
            last.price_usd_blue,
            last.available,
            last.captured_at,
        )
        .join(last, last.listing_id == Listing.id)
        .join(Store, Store.id == Listing.store_id)
        .where(Listing.canonical_product_id.in_(page_ids), Listing.store_id.in_(store_ids))
    )

    # 3) One cell per (product, store): the cheapest listing.
    cells: dict[tuple[uuid.UUID, str], MatrixCellOutput] = {}
    for r in rows:
        if currency == "ars":
            price = r.local_price
        elif rate == "official":
            price = r.price_usd_official
        else:
            price = r.price_usd_blue

        key = (r.canonical_product_id, r.slug)
        current = cells.get(key)
        if current is None or (
            price is not None and (current.price is None or price < current.price)
        ):
            cells[key] = MatrixCellOutput(
                store_slug=r.slug,
                price=price,
                available=r.available,
                captured_at=r.captured_at,
            )

    by_product: dict[uuid.UUID, list[MatrixCellOutput]] = defaultdict(list)
    for (product_id, _), cell in cells.items():
        by_product[product_id].append(cell)

    details = {
        p.id: p
        for p in await db.scalars(select(CanonicalProduct).where(CanonicalProduct.id.in_(page_ids)))
    }

    items = []
    for pid in page_ids:
        product_prices = sorted(by_product[pid], key=lambda c: c.store_slug)
        items.append(
            MatrixRowOutput(
                product_id=pid,
                ean=details[pid].ean,
                name=details[pid].name,
                prices=product_prices,
                spread=_spread(product_prices),
            )
        )

    return MatrixOutput(
        items=items,
        total=total,
        page=page,
        size=size,
        currency=currency,
        rate=effective_rate,
        stores=empty.stores,
    )
