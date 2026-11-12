"""Product page: one canonical product across the stores the user can see."""

import unicodedata
import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CanonicalProduct, Listing, Price, ProductCategory, Store, User
from app.schemas.products import (
    ProductDetailOutput,
    ProductHistoryOutput,
    ProductHistoryPoint,
    ProductStoreOutput,
    ProductSummaryOutput,
    Rate,
)
from app.services.catalog import content_label
from app.services.errors import NotFoundError
from app.services.rates import BUSINESS_TIME_ZONE
from app.services.shrinkflation import SHRINKFLATION_DAYS, shrinkflation_by_listing
from app.services.stores import visible_store_ids

UNIT_PRICE = Decimal("0.0001")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


async def _active_store_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    ids = await visible_store_ids(db, user)
    if not ids:
        return []
    return list(await db.scalars(select(Store.id).where(Store.id.in_(ids), Store.active)))


async def search_products(
    db: AsyncSession,
    user: User,
    *,
    q: str | None,
    category: ProductCategory | None,
    exclude: uuid.UUID | None,
    limit: int,
) -> list[ProductSummaryOutput]:
    """Products published in at least one visible store, by name, brand or EAN."""
    store_ids = await _active_store_ids(db, user)
    if not store_ids:
        return []
    statement = (
        select(CanonicalProduct)
        .where(
            CanonicalProduct.id.in_(
                select(Listing.canonical_product_id).where(Listing.store_id.in_(store_ids))
            )
        )
        .order_by(CanonicalProduct.name, CanonicalProduct.id)
        .limit(limit)
    )
    if category is not None:
        statement = statement.where(CanonicalProduct.category == category)
    if exclude is not None:
        statement = statement.where(CanonicalProduct.id != exclude)
    if q:
        pattern = f"%{_escape_like(_fold(q.strip()))}%"
        searchable = func.lower(
            func.concat_ws(" ", CanonicalProduct.name, CanonicalProduct.brand, CanonicalProduct.ean)
        )
        # Accent-insensitive without the unaccent extension: fold only the common Spanish ones.
        folded = func.translate(searchable, "áéíóúüñ", "aeiouun")
        statement = statement.where(folded.like(pattern, escape="\\"))
    return [ProductSummaryOutput.model_validate(p) for p in await db.scalars(statement)]


async def _visible_listings(
    db: AsyncSession, user: User, product_id: uuid.UUID
) -> tuple[CanonicalProduct, list[tuple[Listing, Store]]]:
    """The product and its listings in the visible stores; 404 if there are none."""
    product = await db.get(CanonicalProduct, product_id)
    store_ids = await _active_store_ids(db, user)
    listings = []
    if product is not None and store_ids:
        listings = [
            (listing, store)
            for listing, store in await db.execute(
                select(Listing, Store)
                .join(Store, Store.id == Listing.store_id)
                .where(
                    Listing.canonical_product_id == product_id,
                    Listing.store_id.in_(store_ids),
                )
                .order_by(Store.name, Listing.id)
            )
        ]
    if product is None or not listings:
        raise NotFoundError("El producto no existe o no está en tus tiendas")
    return product, listings


async def get_product(db: AsyncSession, user: User, product_id: uuid.UUID) -> ProductDetailOutput:
    product, listings = await _visible_listings(db, user, product_id)
    listing_ids = [listing.id for listing, _ in listings]

    latest = {
        price.listing_id: price
        for price in await db.scalars(
            select(Price)
            .ext(distinct_on(Price.listing_id))
            .where(Price.listing_id.in_(listing_ids), Price.location_id.is_(None))
            .order_by(Price.listing_id, Price.captured_at.desc())
        )
    }
    shrinks = await shrinkflation_by_listing(
        db, listing_ids, datetime.now(UTC) - timedelta(days=SHRINKFLATION_DAYS)
    )

    # One card per store: its cheapest current listing.
    by_store: dict[str, ProductStoreOutput] = {}
    for listing, store in listings:
        price = latest.get(listing.id)
        if price is None:
            continue
        per_unit = (
            (price.local_price / price.grammage).quantize(UNIT_PRICE)
            if price.grammage and price.unit in ("g", "ml", "u")
            else None
        )
        card = ProductStoreOutput(
            store_slug=store.slug,
            store_name=store.name,
            url=listing.url,
            local_price=price.local_price,
            regular_price=price.regular_price or price.local_price,
            is_promo=price.is_promo,
            available=price.available,
            captured_at=price.captured_at,
            usd_official=price.price_usd_official,
            usd_blue=price.price_usd_blue,
            content=content_label(price.grammage, price.unit),
            price_per_unit=per_unit,
            unit=price.unit if per_unit is not None else None,
            shrinkflation=shrinks.get(listing.id),
        )
        current = by_store.get(store.slug)
        if current is None or card.local_price < current.local_price:
            by_store[store.slug] = card

    return ProductDetailOutput(
        **ProductSummaryOutput.model_validate(product).model_dump(),
        stores=list(by_store.values()),
    )


def today_in_argentina() -> date:
    return datetime.now(ZoneInfo(BUSINESS_TIME_ZONE)).date()


async def product_history(
    db: AsyncSession,
    user: User,
    product_id: uuid.UUID,
    *,
    days: int,
    rate: Rate,
    end: date | None = None,
) -> ProductHistoryOutput:
    """Last national price of each store on each day, with the rate used at capture time."""
    _, listings = await _visible_listings(db, user, product_id)
    end = end or today_in_argentina()
    start = end - timedelta(days=days)
    slug_of = {listing.id: store.slug for listing, store in listings}

    local_day = cast(func.timezone(BUSINESS_TIME_ZONE, Price.captured_at), Date)
    rows = await db.scalars(
        select(Price)
        .ext(distinct_on(Price.listing_id, local_day))
        .where(
            Price.listing_id.in_(list(slug_of)),
            Price.location_id.is_(None),
            # Wide UTC window (± 1 day), then filtered by the local day.
            Price.captured_at >= datetime.combine(start - timedelta(days=1), time.min, UTC),
            Price.captured_at < datetime.combine(end + timedelta(days=2), time.min, UTC),
            local_day.between(start, end),
        )
        .order_by(Price.listing_id, local_day, Price.captured_at.desc())
    )

    zone = ZoneInfo(BUSINESS_TIME_ZONE)
    points: dict[tuple[date, str], ProductHistoryPoint] = {}
    for price in rows:
        day = price.captured_at.astimezone(zone).date()
        slug = slug_of[price.listing_id]
        usd = price.price_usd_official if rate == "official" else price.price_usd_blue
        point = ProductHistoryPoint(
            date=day,
            store_slug=slug,
            price=price.local_price,
            regular_price=price.regular_price or price.local_price,
            is_promo=price.is_promo,
            content=content_label(price.grammage, price.unit),
            usd_price=usd,
            fx=price.fx_official if rate == "official" else price.fx_blue,
            quoted_at=price.quoted_at,
        )
        # Several listings of the same store: keep the cheapest, like the matrix.
        current = points.get((day, slug))
        if current is None or point.price < current.price:
            points[(day, slug)] = point

    stores = []
    for _, store in listings:
        if not any(s["slug"] == store.slug for s in stores):
            stores.append({"slug": store.slug, "name": store.name})

    return ProductHistoryOutput(
        rate=rate,
        start=start,
        end=end,
        stores=stores,
        points=sorted(points.values(), key=lambda p: (p.date, p.store_slug)),
    )
