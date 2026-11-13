"""Curation: listings that could not be linked to a canonical product by EAN.

Each listing without a canonical product gets one `ListingMatch` with the most similar
canonical product (trigram similarity of the name, plus brand and net content). An admin
confirms it, separates it, or proposes another product. Every change writes a
`CurationEvent` with what is needed to undo it; only the latest one can be reverted.
"""

import unicodedata
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AlertRule,
    CanonicalEanAlias,
    CanonicalProduct,
    CurationAction,
    CurationEvent,
    Listing,
    ListingMatch,
    MatchStatus,
    Price,
    ProductCategory,
    Store,
    User,
)
from app.schemas.curation import (
    CanonicalInput,
    CanonicalOutput,
    CurationEventOutput,
    QueueItemOutput,
    QueueListingOutput,
    QueueOutput,
    QueueStoreOutput,
    RevertedOutput,
    SuggestedOutput,
)
from app.services.catalog import classify_category, parse_net_content
from app.services.errors import BusinessError, ConflictError, NotFoundError

# Weights of the suggestion score. The name decides; brand and content confirm.
NAME_WEIGHT = Decimal("0.7")
BRAND_WEIGHT = Decimal("0.15")
CONTENT_WEIGHT = Decimal("0.15")
CANDIDATES = 5
QUEUE_LIMIT = 200
SCORE_PLACES = Decimal("0.001")

# Canonical product columns saved in a merge, to rebuild the duplicate on revert.
_PRODUCT_FIELDS = ("ean", "name", "category", "brand", "content", "grammage", "unit")


def _fold(text: str | None) -> str:
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFD", text)
    return " ".join(
        "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower().split()
    )


def _code(product: CanonicalProduct) -> str:
    return f"EAN {product.ean}" if product.ean else "sin EAN"


def _label(product: CanonicalProduct) -> str:
    return " ".join(filter(None, [product.name, product.content]))


# --- Suggestions ---------------------------------------------------------------------


async def suggest(
    db: AsyncSession, name: str, brand: str | None
) -> tuple[uuid.UUID | None, Decimal | None]:
    """The canonical product most similar to a listing, and its score (0–1)."""
    needle = name.lower()
    similarity = func.similarity(func.lower(CanonicalProduct.name), needle)
    rows = await db.execute(
        select(CanonicalProduct, similarity)
        # `%` uses the trigram index (similarity above pg_trgm.similarity_threshold, 0.3).
        .where(func.lower(CanonicalProduct.name).op("%")(needle))
        .order_by(similarity.desc(), CanonicalProduct.id)
        .limit(CANDIDATES)
    )
    content = parse_net_content(name)
    best: tuple[uuid.UUID | None, Decimal | None] = (None, None)
    for product, name_similarity in rows:
        score = NAME_WEIGHT * Decimal(str(name_similarity))
        if brand and product.brand and _fold(brand) == _fold(product.brand):
            score += BRAND_WEIGHT
        if (
            content is not None
            and product.grammage is not None
            and content.unit == product.unit
            and content.amount == product.grammage
        ):
            score += CONTENT_WEIGHT
        score = min(score, Decimal(1)).quantize(SCORE_PLACES)
        if best[1] is None or score > best[1]:
            best = (product.id, score)
    return best


async def ensure_match(
    db: AsyncSession, listing_id: uuid.UUID, name: str, brand: str | None
) -> None:
    """Queue a listing without a canonical product, once. Decided ones are not requeued."""
    exists = await db.scalar(select(ListingMatch.id).where(ListingMatch.listing_id == listing_id))
    if exists is not None:
        return
    canonical_id, score = await suggest(db, name, brand)
    await db.execute(
        pg_insert(ListingMatch)
        .values(
            id=uuid.uuid4(),
            listing_id=listing_id,
            suggested_canonical_id=canonical_id,
            score=score,
            status=MatchStatus.PENDING,
        )
        .on_conflict_do_nothing(index_elements=["listing_id"])
    )


async def queue_unmatched(db: AsyncSession) -> int:
    """Create the missing matches for listings without a canonical product (backfill)."""
    listings = (
        await db.execute(
            select(Listing.id, Listing.name, Listing.brand)
            .outerjoin(ListingMatch, ListingMatch.listing_id == Listing.id)
            .where(Listing.canonical_product_id.is_(None), ListingMatch.id.is_(None))
        )
    ).all()
    for listing_id, name, brand in listings:
        await ensure_match(db, listing_id, name, brand)
    await db.commit()
    return len(listings)


async def resolve_ean(db: AsyncSession, ean: str) -> uuid.UUID | None:
    """The product that absorbed this EAN in a merge, if any."""
    return await db.scalar(
        select(CanonicalEanAlias.canonical_product_id).where(CanonicalEanAlias.ean == ean)
    )


# --- Queue ---------------------------------------------------------------------------


async def _latest_prices(
    db: AsyncSession, listing_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Decimal]:
    if not listing_ids:
        return {}
    rows = await db.execute(
        select(Price.listing_id, Price.local_price)
        .ext(distinct_on(Price.listing_id))
        .where(Price.listing_id.in_(listing_ids), Price.location_id.is_(None))
        .order_by(Price.listing_id, Price.captured_at.desc())
    )
    return {listing_id: price for listing_id, price in rows}


async def _average_prices(
    db: AsyncSession, canonical_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Decimal]:
    if not canonical_ids:
        return {}
    listings = (
        await db.execute(
            select(Listing.id, Listing.canonical_product_id).where(
                Listing.canonical_product_id.in_(canonical_ids)
            )
        )
    ).all()
    prices = await _latest_prices(db, [listing_id for listing_id, _ in listings])
    grouped: dict[uuid.UUID, list[Decimal]] = {}
    for listing_id, canonical_id in listings:
        if listing_id in prices:
            grouped.setdefault(canonical_id, []).append(prices[listing_id])
    return {
        canonical_id: (sum(values) / len(values)).quantize(Decimal("0.01"))
        for canonical_id, values in grouped.items()
    }


async def queue(
    db: AsyncSession, *, store_slug: str | None, category: ProductCategory | None
) -> QueueOutput:
    rows = (
        await db.execute(
            select(ListingMatch, Listing, Store)
            .join(Listing, Listing.id == ListingMatch.listing_id)
            .join(Store, Store.id == Listing.store_id)
            # A listing linked by EAN after it was queued leaves the queue.
            .where(
                ListingMatch.status == MatchStatus.PENDING,
                Listing.canonical_product_id.is_(None),
            )
        )
    ).all()
    categories = {listing.id: classify_category(listing.source_category) for _, listing, _ in rows}

    stores = {store.slug: store.name for _, _, store in rows}
    present = {c for c in categories.values() if c is not None}
    visible = [
        row
        for row in rows
        if (store_slug is None or row[2].slug == store_slug)
        and (category is None or categories[row[1].id] == category)
    ]
    # Manual proposals first (an admin is working on them), then the least confident.
    visible.sort(
        key=lambda row: (
            not row[0].manual,
            row[0].score if row[0].score is not None else Decimal(-1),
            row[0].created_at,
        )
    )
    visible = visible[:QUEUE_LIMIT]

    suggested_ids = {m.suggested_canonical_id for m, _, _ in visible if m.suggested_canonical_id}
    products = {
        p.id: p
        for p in await db.scalars(
            select(CanonicalProduct).where(CanonicalProduct.id.in_(suggested_ids))
        )
    }
    listing_prices = await _latest_prices(db, [listing.id for _, listing, _ in visible])
    average = await _average_prices(db, list(suggested_ids))

    items = []
    for match, listing, store in visible:
        product = products.get(match.suggested_canonical_id)
        content = parse_net_content(listing.name)
        items.append(
            QueueItemOutput(
                id=match.id,
                store=QueueStoreOutput(slug=store.slug, name=store.name),
                score=match.score,
                manual=match.manual,
                created_at=match.created_at,
                listing=QueueListingOutput(
                    id=listing.id,
                    name=listing.name,
                    brand=listing.brand,
                    content=content.label if content else None,
                    category=categories[listing.id],
                    source_category=listing.source_category,
                    external_code=listing.external_code,
                    url=listing.url,
                    price=listing_prices.get(listing.id),
                ),
                suggested=None
                if product is None
                else SuggestedOutput(
                    **CanonicalOutput.model_validate(product).model_dump(),
                    price=average.get(product.id),
                ),
            )
        )
    return QueueOutput(
        total=len(rows),
        stores=[
            QueueStoreOutput(slug=s, name=n) for s, n in sorted(stores.items(), key=lambda x: x[1])
        ],
        categories=[c for c in ProductCategory if c in present],
        uncategorized=any(c is None for c in categories.values()),
        items=items,
    )


async def search_canonical(
    db: AsyncSession, *, q: str | None, exclude: uuid.UUID | None, limit: int
) -> list[CanonicalOutput]:
    """Canonical products by name, brand or EAN; the most similar first."""
    statement = select(CanonicalProduct).limit(limit)
    if exclude is not None:
        statement = statement.where(CanonicalProduct.id != exclude)
    needle = (q or "").strip().lower()
    if needle:
        searchable = func.lower(
            func.concat_ws(" ", CanonicalProduct.name, CanonicalProduct.brand, CanonicalProduct.ean)
        )
        escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(
            searchable.like(f"%{escaped}%", escape="\\")
            | func.lower(CanonicalProduct.name).op("%")(needle)
        ).order_by(
            func.similarity(func.lower(CanonicalProduct.name), needle).desc(),
            CanonicalProduct.name,
        )
    else:
        statement = statement.order_by(CanonicalProduct.name, CanonicalProduct.id)
    return [CanonicalOutput.model_validate(p) for p in await db.scalars(statement)]


# --- Decisions -----------------------------------------------------------------------


async def _pending(db: AsyncSession, match_id: uuid.UUID) -> tuple[ListingMatch, Listing, Store]:
    row = (
        await db.execute(
            select(ListingMatch, Listing, Store)
            .join(Listing, Listing.id == ListingMatch.listing_id)
            .join(Store, Store.id == Listing.store_id)
            .where(ListingMatch.id == match_id)
            .with_for_update(of=ListingMatch)
        )
    ).first()
    if row is None:
        raise NotFoundError("La publicación no está en la cola de curaduría")
    match, listing, store = row
    if match.status != MatchStatus.PENDING or listing.canonical_product_id is not None:
        raise ConflictError("La publicación ya no está pendiente de revisión")
    return match, listing, store


async def _record(
    db: AsyncSession,
    admin: User,
    action: CurationAction,
    before: str,
    after: str,
    payload: dict[str, Any],
) -> CurationEventOutput:
    event = CurationEvent(
        admin_id=admin.id,
        admin_name=admin.name,
        action=action,
        before=before,
        after=after,
        payload=payload,
        created_at=datetime.now(UTC),
    )
    db.add(event)
    await db.commit()
    return _event_output(event, revertible=True)


def _match_state(match: ListingMatch) -> dict[str, Any]:
    return {
        "suggested": str(match.suggested_canonical_id) if match.suggested_canonical_id else None,
        "score": str(match.score) if match.score is not None else None,
        "manual": match.manual,
    }


async def decide(
    db: AsyncSession, admin: User, match_id: uuid.UUID, status: MatchStatus
) -> CurationEventOutput:
    """Confirm the suggestion (links the listing) or separate it (stays unlinked)."""
    match, listing, store = await _pending(db, match_id)
    product = (
        await db.get(CanonicalProduct, match.suggested_canonical_id)
        if match.suggested_canonical_id
        else None
    )
    if status == MatchStatus.CONFIRMED and product is None:
        raise ConflictError("La publicación no tiene un canónico propuesto")

    publication = f"{listing.name} · {store.name}"
    before = (
        f"{publication} → {_label(product)} (sin confirmar)"
        if product
        else f"{publication} → sin propuesta"
    )
    match.status = status
    match.decided_by = admin.id
    match.decided_at = datetime.now(UTC)
    if status == MatchStatus.CONFIRMED:
        listing.canonical_product_id = product.id
        action, after = CurationAction.CONFIRMED, f"{publication} → {_label(product)}"
    else:
        action, after = CurationAction.SEPARATED, f"{publication} → sin vinculación"
    return await _record(
        db,
        admin,
        action,
        before,
        after,
        {"match_id": str(match.id), "listing_id": str(listing.id)},
    )


async def choose(
    db: AsyncSession, admin: User, match_id: uuid.UUID, canonical_id: uuid.UUID
) -> CurationEventOutput:
    """Propose another existing product. The item stays pending, marked as manual."""
    match, listing, _ = await _pending(db, match_id)
    if match.suggested_canonical_id == canonical_id:
        raise ConflictError("Ese canónico ya está propuesto")
    target = await db.get(CanonicalProduct, canonical_id)
    if target is None:
        raise NotFoundError("El canónico seleccionado ya no está disponible")
    return await _propose(db, admin, match, listing, target, CurationAction.CHOSEN, {})


async def create(
    db: AsyncSession, admin: User, match_id: uuid.UUID, data: CanonicalInput
) -> CurationEventOutput:
    """Create a canonical product from the listing and propose it."""
    match, listing, _ = await _pending(db, match_id)
    if data.ean is not None and (
        await db.scalar(select(CanonicalProduct.id).where(CanonicalProduct.ean == data.ean))
        or await resolve_ean(db, data.ean)
    ):
        raise ConflictError("Ya existe un canónico con ese EAN. Usá Elegir otro canónico.")
    content = parse_net_content(data.content)
    product = CanonicalProduct(
        ean=data.ean,
        name=data.name,
        brand=data.brand,
        content=data.content,
        category=data.category,
        grammage=content.amount if content else None,
        unit=content.unit if content else None,
    )
    db.add(product)
    await db.flush()
    return await _propose(
        db, admin, match, listing, product, CurationAction.CREATED, {"created": str(product.id)}
    )


async def _propose(
    db: AsyncSession,
    admin: User,
    match: ListingMatch,
    listing: Listing,
    target: CanonicalProduct,
    action: CurationAction,
    extra: dict[str, Any],
) -> CurationEventOutput:
    previous = (
        await db.get(CanonicalProduct, match.suggested_canonical_id)
        if match.suggested_canonical_id
        else None
    )
    payload = {"match_id": str(match.id), "previous": _match_state(match), **extra}
    before = (
        f"{listing.name} → {previous.name} ({_code(previous)})"
        if previous
        else f"{listing.name} → sin propuesta"
    )
    match.suggested_canonical_id = target.id
    match.manual = True
    return await _record(
        db,
        admin,
        action,
        before,
        f"{listing.name} → {target.name} ({_code(target)}) (pendiente de confirmar)",
        payload,
    )


def _snapshot(product: CanonicalProduct) -> dict[str, Any]:
    values = {field: getattr(product, field) for field in _PRODUCT_FIELDS}
    values["grammage"] = str(product.grammage) if product.grammage is not None else None
    return values


def _from_snapshot(values: dict[str, Any]) -> dict[str, Any]:
    return {
        **values,
        "grammage": Decimal(values["grammage"]) if values["grammage"] is not None else None,
        "category": ProductCategory(values["category"]) if values["category"] else None,
    }


def _restore(product: CanonicalProduct, values: dict[str, Any]) -> None:
    for field, value in _from_snapshot(values).items():
        setattr(product, field, value)


async def merge(
    db: AsyncSession, admin: User, source_id: uuid.UUID, target_id: uuid.UUID
) -> CurationEventOutput:
    """Move everything from the duplicate (source) to the target and delete the duplicate.

    Listings, suggestions, alert rules and EAN aliases follow the target. The duplicate's
    EAN becomes an alias, so the scrapers keep feeding the target. Empty attributes of the
    target are filled from the duplicate.
    """
    if source_id == target_id:
        raise BusinessError("Elegí dos canónicos distintos")
    found = {
        p.id: p
        for p in await db.scalars(
            select(CanonicalProduct)
            .where(CanonicalProduct.id.in_([source_id, target_id]))
            .with_for_update()
        )
    }
    source, target = found.get(source_id), found.get(target_id)
    if source is None or target is None:
        raise NotFoundError("Uno de los canónicos ya no está disponible")

    before = f"{source.name} ({_code(source)}) + {target.name} ({_code(target)})"
    payload: dict[str, Any] = {
        "source_id": str(source.id),
        "target_id": str(target.id),
        "source": _snapshot(source),
        "source_created_at": source.created_at.isoformat(),
        "target": _snapshot(target),
    }

    async def move(column, table) -> list[str]:  # noqa: ANN001
        rows = await db.execute(
            update(table)
            .where(column == source.id)
            .values({column.key: target.id})
            .returning(table.__table__.primary_key.columns.values()[0])
        )
        return [str(key) for key in rows.scalars()]

    payload["listings"] = await move(Listing.canonical_product_id, Listing)
    payload["matches"] = await move(ListingMatch.suggested_canonical_id, ListingMatch)
    payload["rules"] = await move(AlertRule.canonical_product_id, AlertRule)
    payload["aliases"] = await move(CanonicalEanAlias.canonical_product_id, CanonicalEanAlias)

    values = {field: getattr(source, field) for field in _PRODUCT_FIELDS}
    await db.delete(source)
    await db.flush()

    payload["alias"] = None
    if values["ean"] is not None:
        if target.ean is None:
            target.ean = values["ean"]
        else:
            db.add(CanonicalEanAlias(ean=values["ean"], canonical_product_id=target.id))
            payload["alias"] = values["ean"]
    for field in ("category", "brand", "content", "grammage", "unit"):
        if getattr(target, field) is None and values[field] is not None:
            setattr(target, field, values[field])

    return await _record(
        db,
        admin,
        CurationAction.MERGED,
        before,
        f"{_label(target)} ({_code(target)})",
        payload,
    )


# --- History -------------------------------------------------------------------------


def _event_output(event: CurationEvent, *, revertible: bool) -> CurationEventOutput:
    return CurationEventOutput(
        id=event.id,
        at=event.created_at,
        admin=event.admin_name,
        action=event.action,
        before=event.before,
        after=event.after,
        reverted=RevertedOutput(at=event.reverted_at, admin=event.reverted_by_name or "")
        if event.reverted_at
        else None,
        revertible=revertible,
    )


async def _latest_reversible(db: AsyncSession, *, lock: bool = False) -> CurationEvent | None:
    statement = (
        select(CurationEvent)
        .where(CurationEvent.reverted_at.is_(None))
        .order_by(CurationEvent.created_at.desc(), CurationEvent.id.desc())
        .limit(1)
    )
    if lock:
        statement = statement.with_for_update()
    return await db.scalar(statement)


async def history(db: AsyncSession, *, limit: int) -> list[CurationEventOutput]:
    latest = await _latest_reversible(db)
    events = await db.scalars(
        select(CurationEvent)
        .order_by(CurationEvent.created_at.desc(), CurationEvent.id.desc())
        .limit(limit)
    )
    return [
        _event_output(event, revertible=latest is not None and event.id == latest.id)
        for event in events
    ]


async def revert(db: AsyncSession, admin: User, event_id: uuid.UUID) -> CurationEventOutput:
    """Undo the latest change that is not reverted yet."""
    event = await db.get(CurationEvent, event_id)
    if event is None:
        raise NotFoundError("El cambio no existe")
    latest = await _latest_reversible(db, lock=True)
    if latest is None or latest.id != event.id:
        raise ConflictError("Revertí primero los cambios posteriores")

    payload = event.payload
    if event.action in (CurationAction.CONFIRMED, CurationAction.SEPARATED):
        await _revert_decision(db, payload)
    elif event.action in (CurationAction.CHOSEN, CurationAction.CREATED):
        await _revert_proposal(db, payload)
    else:
        await _revert_merge(db, payload)

    event.reverted_at = datetime.now(UTC)
    event.reverted_by = admin.id
    event.reverted_by_name = admin.name
    await db.commit()
    return _event_output(event, revertible=False)


async def _revert_decision(db: AsyncSession, payload: dict[str, Any]) -> None:
    match = await db.get(ListingMatch, uuid.UUID(payload["match_id"]), with_for_update=True)
    listing = await db.get(Listing, uuid.UUID(payload["listing_id"]), with_for_update=True)
    if match is None or listing is None or match.status == MatchStatus.PENDING:
        raise ConflictError("La publicación cambió desde esta decisión y no se puede revertir")
    if match.status == MatchStatus.CONFIRMED:
        if listing.canonical_product_id != match.suggested_canonical_id:
            raise ConflictError("La publicación cambió desde esta decisión y no se puede revertir")
        listing.canonical_product_id = None
    match.status = MatchStatus.PENDING
    match.decided_by = None
    match.decided_at = None


async def _revert_proposal(db: AsyncSession, payload: dict[str, Any]) -> None:
    match = await db.get(ListingMatch, uuid.UUID(payload["match_id"]), with_for_update=True)
    if match is None or match.status != MatchStatus.PENDING:
        raise ConflictError("La publicación cambió desde esta propuesta y no se puede revertir")
    previous = payload["previous"]
    match.suggested_canonical_id = (
        uuid.UUID(previous["suggested"]) if previous["suggested"] else None
    )
    match.score = Decimal(previous["score"]) if previous["score"] is not None else None
    match.manual = previous["manual"]

    if created := payload.get("created"):
        product_id = uuid.UUID(created)
        used = await db.scalar(
            select(func.count())
            .select_from(Listing)
            .where(Listing.canonical_product_id == product_id)
        ) or await db.scalar(
            select(func.count())
            .select_from(AlertRule)
            .where(AlertRule.canonical_product_id == product_id)
        )
        if used:
            raise ConflictError("El canónico creado ya tiene publicaciones o reglas asociadas")
        await db.flush()
        await db.execute(delete(CanonicalProduct).where(CanonicalProduct.id == product_id))


async def _revert_merge(db: AsyncSession, payload: dict[str, Any]) -> None:
    target = await db.get(CanonicalProduct, uuid.UUID(payload["target_id"]), with_for_update=True)
    if target is None:
        raise ConflictError("El canónico principal ya no existe")
    source_id = uuid.UUID(payload["source_id"])

    # The target gives the EAN back before the duplicate is created again.
    _restore(target, payload["target"])
    if payload["alias"]:
        await db.execute(delete(CanonicalEanAlias).where(CanonicalEanAlias.ean == payload["alias"]))
    await db.flush()

    await db.execute(
        insert(CanonicalProduct).values(
            id=source_id,
            created_at=datetime.fromisoformat(payload["source_created_at"]),
            **_from_snapshot(payload["source"]),
        )
    )

    async def move_back(table, column, keys: list[str]) -> None:  # noqa: ANN001
        if not keys:
            return
        key = table.__table__.primary_key.columns.values()[0]
        await db.execute(
            update(table)
            .where(key.in_(keys if key.key == "ean" else [uuid.UUID(k) for k in keys]))
            .where(column == target.id)
            .values({column.key: source_id})
        )

    await move_back(Listing, Listing.canonical_product_id, payload["listings"])
    await move_back(ListingMatch, ListingMatch.suggested_canonical_id, payload["matches"])
    await move_back(AlertRule, AlertRule.canonical_product_id, payload["rules"])
    await move_back(CanonicalEanAlias, CanonicalEanAlias.canonical_product_id, payload["aliases"])
