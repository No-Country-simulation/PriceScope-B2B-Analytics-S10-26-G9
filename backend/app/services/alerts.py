"""Alert rules: CRUD, evaluation against prices and rates, daily run and the inbox.

`evaluate_rule` is shared by the preview and the daily worker, so the preview shows
exactly what would fire today (see ALERTAS-BACKEND.md §4).
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AlertRule,
    AlertRuleKind,
    AlertRuleScope,
    CanonicalProduct,
    ExchangeRate,
    FiredAlert,
    FiredAlertItem,
    Listing,
    MilestoneKey,
    Price,
    ProductCategory,
    RateType,
    Store,
    User,
    UserStatus,
)
from app.schemas.alerts import (
    AlertRuleInput,
    AlertRuleOutput,
    AlertRulePatch,
    AlertsSummaryOutput,
    FiredAlertDetailOutput,
    FiredAlertItemOutput,
    FiredAlertOutput,
    Milestone,
    OptionStore,
    PreviewItem,
    RuleConditions,
    RuleOptionsOutput,
    RulePreviewOutput,
)
from app.schemas.common import Page
from app.services.errors import BusinessError, NotFoundError
from app.services.rates import BUSINESS_TIME_ZONE
from app.services.stores import visible_stores

log = logging.getLogger(__name__)

MAX_RULES = 50
PERIODS = (7, 30, 90)
# A price or rate older than this before an end of the window does not count.
LOOKBACK_DAYS = 7
# A listing that already fired for a rule does not count again for this many days.
REPEAT_DAYS = 7
PREVIEW_ITEMS = 10
SUMMARY_DAYS = 30
CENTS = Decimal("0.01")
ZONE = ZoneInfo(BUSINESS_TIME_ZONE)

CATEGORY_LABEL = {
    ProductCategory.ALMACEN: "Almacén",
    ProductCategory.BEBIDAS: "Bebidas",
    ProductCategory.LACTEOS: "Lácteos",
    ProductCategory.LIMPIEZA: "Limpieza",
    ProductCategory.ELECTRO: "Electro",
    ProductCategory.INDUMENTARIA: "Indumentaria",
}
RATE_LABEL = {RateType.BLUE: "blue", RateType.OFFICIAL: "oficial"}
MILESTONE_LABEL = {
    MilestoneKey.CYBERWEEK: "CyberWeek",
    MilestoneKey.BLACK_FRIDAY: "Black Friday",
    MilestoneKey.HOT_SALE: "Hot Sale",
}
# Known dates of each milestone. For now a constant; it can become a table the admin edits.
MILESTONE_DATES: dict[MilestoneKey, list[tuple[date, date]]] = {
    MilestoneKey.CYBERWEEK: [
        (date(2026, 11, 3), date(2026, 11, 9)),
        (date(2027, 11, 1), date(2027, 11, 7)),
    ],
    MilestoneKey.BLACK_FRIDAY: [
        (date(2026, 11, 27), date(2026, 11, 30)),
        (date(2027, 11, 26), date(2027, 11, 29)),
    ],
    MilestoneKey.HOT_SALE: [
        (date(2026, 5, 11), date(2026, 5, 13)),
        (date(2027, 5, 10), date(2027, 5, 12)),
    ],
}


def today_in_argentina() -> date:
    return datetime.now(ZONE).date()


def next_milestones(today: date) -> list[Milestone]:
    """The current or next dates of each milestone (the last known ones if all passed)."""
    result = []
    for key, ranges in MILESTONE_DATES.items():
        starts_on, ends_on = next((r for r in ranges if r[1] >= today), ranges[-1])
        result.append(
            Milestone(key=key, label=MILESTONE_LABEL[key], starts_on=starts_on, ends_on=ends_on)
        )
    return sorted(result, key=lambda m: m.starts_on)


# --- Phrases --------------------------------------------------------------------------


class _RuleLike(Protocol):
    kind: AlertRuleKind
    scope: AlertRuleScope
    category: str | None
    canonical_product_id: uuid.UUID | None
    store_id: uuid.UUID | None
    rate_type: RateType
    threshold_pp: Decimal
    period_days: int | None
    milestone_key: MilestoneKey | None
    starts_on: date | None
    ends_on: date | None


def _number(value: Decimal) -> str:
    """2 → "2", 2.50 → "2,5"."""
    text = f"{value.normalize():f}"
    return text.replace(".", ",")


def _short_date(day: date) -> str:
    return day.strftime("%d/%m")


def _milestone_name(rule: _RuleLike) -> str:
    if rule.milestone_key and rule.milestone_key != MilestoneKey.CUSTOM:
        return MILESTONE_LABEL[rule.milestone_key]
    return "el rango elegido"


def _category_label(category: str | None) -> str:
    return CATEGORY_LABEL[ProductCategory(category)] if category else ""


def rule_phrase(rule: _RuleLike, product_name: str | None, store_name: str | None) -> str:
    """Same template as the Phrase component of rule-form.tsx."""
    target = (
        f"un producto de {_category_label(rule.category)}"
        if rule.scope == AlertRuleScope.CATEGORY
        else product_name or "el producto"
    )
    store = store_name or "cualquier tienda"
    threshold = f"{_number(rule.threshold_pp)} p.p."
    quote = f"dólar {RATE_LABEL[rule.rate_type]}"
    if rule.kind == AlertRuleKind.MILESTONE:
        return (
            f"Avisame si durante {_milestone_name(rule)} {target} en {store} sube más de "
            f"{threshold} por encima del {quote}."
        )
    return (
        f"Avisame cuando {target} en {store} suba más de {threshold} por encima del "
        f"{quote} en los últimos {rule.period_days} días."
    )


def fired_phrase(rule: _RuleLike, product_name: str | None, store_name: str | None) -> str:
    """The same sentence in the past, for the inbox."""
    category = rule.scope == AlertRuleScope.CATEGORY
    target = f"productos de {_category_label(rule.category)}" if category else product_name or ""
    verb = "subieron" if category else "subió"
    store = store_name or "cualquier tienda"
    threshold = f"{_number(rule.threshold_pp)} p.p."
    quote = f"dólar {RATE_LABEL[rule.rate_type]}"
    if rule.kind == AlertRuleKind.MILESTONE:
        return (
            f"Durante {_milestone_name(rule)}, {target} en {store} {verb} su precio regular "
            f"más de {threshold} por encima del {quote}."
        )
    return (
        f"{target[0].upper()}{target[1:]} en {store} {verb} más de {threshold} por encima del "
        f"{quote} en los últimos {rule.period_days} días."
    )


def scope_label(rule: _RuleLike, product_name: str | None, store_name: str | None) -> str:
    target = (
        _category_label(rule.category)
        if rule.scope == AlertRuleScope.CATEGORY
        else product_name or "Producto"
    )
    store = store_name or "todas las tiendas"
    if rule.kind == AlertRuleKind.MILESTONE and rule.starts_on and rule.ends_on:
        name = _milestone_name(rule) if rule.milestone_key != MilestoneKey.CUSTOM else "propio"
        return (
            f"Hito {name} · {target} · {store} · "
            f"{_short_date(rule.starts_on)} a {_short_date(rule.ends_on)}"
        )
    return f"{target} · {store} · {rule.period_days} días"


# --- Validation -----------------------------------------------------------------------


class InvalidRuleError(BusinessError):
    status_code = 422


@dataclass
class _Names:
    product: str | None
    store: str | None


async def _check_conditions(db: AsyncSession, user: User, rule: _RuleLike) -> _Names:
    """Cross-field checks with the messages the form shows as they are."""
    if rule.threshold_pp is None or rule.threshold_pp < 0:
        raise InvalidRuleError("Ingresá un número igual o mayor a 0.")
    if rule.threshold_pp >= 1000:
        raise InvalidRuleError("El umbral no puede superar 999 p.p.")
    if rule.kind == AlertRuleKind.DEVALUATION:
        if rule.period_days not in PERIODS:
            raise InvalidRuleError("Elegí un período de 7, 30 o 90 días.")
    else:
        if rule.starts_on is None or rule.ends_on is None:
            raise InvalidRuleError("Elegí las fechas del hito.")
        if rule.starts_on > rule.ends_on:
            raise InvalidRuleError(
                "Revisá el rango: la fecha “hasta” no puede ser anterior a “desde”."
            )
    if rule.scope == AlertRuleScope.CATEGORY and rule.category is None:
        raise InvalidRuleError("Elegí una categoría.")
    if rule.scope == AlertRuleScope.PRODUCT and rule.canonical_product_id is None:
        raise InvalidRuleError("Elegí un producto.")

    stores = await visible_stores(db, user)
    store_name = None
    if rule.store_id is not None:
        store = next((s for s in stores if s.id == rule.store_id), None)
        if store is None:
            raise BusinessError("Esa tienda no está asignada a tu cuenta.")
        store_name = store.name

    product_name = None
    if rule.scope == AlertRuleScope.PRODUCT:
        store_ids = [rule.store_id] if rule.store_id else [s.id for s in stores]
        product_name = await db.scalar(
            select(CanonicalProduct.name).where(
                CanonicalProduct.id == rule.canonical_product_id,
                CanonicalProduct.id.in_(
                    select(Listing.canonical_product_id).where(Listing.store_id.in_(store_ids))
                ),
            )
        )
        if product_name is None:
            raise BusinessError("Ese producto no está en tus tiendas.")
    return _Names(product=product_name, store=store_name)


def _check_name(name: str | None) -> str:
    name = (name or "").strip()
    if not name or len(name) > 80:
        raise InvalidRuleError("Ponele un nombre a la regla.")
    return name


def _normalize(rule: AlertRule) -> None:
    """Clear the fields that do not apply to the kind and scope, so the CHECKs hold."""
    if rule.scope == AlertRuleScope.CATEGORY:
        rule.canonical_product_id = None
    else:
        rule.category = None
    if rule.kind == AlertRuleKind.DEVALUATION:
        rule.milestone_key = None
        rule.starts_on = None
        rule.ends_on = None
    else:
        rule.period_days = None
        rule.milestone_key = rule.milestone_key or MilestoneKey.CUSTOM


# --- Rules CRUD -----------------------------------------------------------------------


async def _names(db: AsyncSession, rules: list[AlertRule]) -> dict[uuid.UUID, _Names]:
    product_ids = {r.canonical_product_id for r in rules if r.canonical_product_id}
    store_ids = {r.store_id for r in rules if r.store_id}
    products = dict(
        (
            await db.execute(
                select(CanonicalProduct.id, CanonicalProduct.name).where(
                    CanonicalProduct.id.in_(product_ids)
                )
            )
        ).all()
        if product_ids
        else []
    )
    stores = dict(
        (await db.execute(select(Store.id, Store.name).where(Store.id.in_(store_ids)))).all()
        if store_ids
        else []
    )
    return {
        r.id: _Names(product=products.get(r.canonical_product_id), store=stores.get(r.store_id))
        for r in rules
    }


def _output(rule: AlertRule, names: _Names) -> AlertRuleOutput:
    return AlertRuleOutput(
        id=rule.id,
        name=rule.name,
        kind=rule.kind,
        scope=rule.scope,
        category=ProductCategory(rule.category) if rule.category else None,
        canonical_product_id=rule.canonical_product_id,
        product_name=names.product,
        store_id=rule.store_id,
        store_name=names.store,
        rate_type=rule.rate_type,
        threshold_pp=rule.threshold_pp,
        period_days=rule.period_days,
        milestone_key=rule.milestone_key,
        starts_on=rule.starts_on,
        ends_on=rule.ends_on,
        notify_in_app=rule.notify_in_app,
        notify_email=rule.notify_email,
        active=rule.active,
        phrase=rule_phrase(rule, names.product, names.store),
        last_fired_at=rule.last_fired_at,
        created_at=rule.created_at,
    )


async def list_rules(db: AsyncSession, user: User) -> list[AlertRuleOutput]:
    rules = list(
        await db.scalars(
            select(AlertRule)
            .where(AlertRule.user_id == user.id)
            .order_by(AlertRule.created_at.desc(), AlertRule.id)
        )
    )
    names = await _names(db, rules)
    return [_output(rule, names[rule.id]) for rule in rules]


async def _own_rule(db: AsyncSession, user: User, rule_id: uuid.UUID) -> AlertRule:
    rule = await db.get(AlertRule, rule_id)
    # Another user's rule answers 404 too, so its existence is not revealed.
    if rule is None or rule.user_id != user.id:
        raise NotFoundError("La regla no existe")
    return rule


async def get_rule(db: AsyncSession, user: User, rule_id: uuid.UUID) -> AlertRuleOutput:
    rule = await _own_rule(db, user, rule_id)
    return _output(rule, (await _names(db, [rule]))[rule.id])


def _check_email(notify_email: bool | None) -> None:
    if notify_email:
        raise BusinessError("El aviso por correo todavía no está disponible.")


async def create_rule(db: AsyncSession, user: User, data: AlertRuleInput) -> AlertRuleOutput:
    name = _check_name(data.name)
    _check_email(data.notify_email)
    count = await db.scalar(
        select(func.count()).select_from(AlertRule).where(AlertRule.user_id == user.id)
    )
    if count >= MAX_RULES:
        raise BusinessError(f"Llegaste al máximo de {MAX_RULES} reglas.")
    rule = AlertRule(user_id=user.id, **data.model_dump(exclude={"name"}), name=name)
    _normalize(rule)
    names = await _check_conditions(db, user, rule)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _output(rule, names)


async def update_rule(
    db: AsyncSession, user: User, rule_id: uuid.UUID, data: AlertRulePatch
) -> AlertRuleOutput:
    rule = await _own_rule(db, user, rule_id)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = _check_name(changes["name"])
    _check_email(changes.get("notify_email"))
    for field, value in changes.items():
        setattr(rule, field, value)
    _normalize(rule)
    # Pausing or resuming does not re-check the conditions: a rule whose store was
    # unassigned can still be paused or deleted.
    if set(changes) - {"active", "name", "notify_in_app"}:
        names = await _check_conditions(db, user, rule)
    else:
        names = (await _names(db, [rule]))[rule.id]
    await db.commit()
    await db.refresh(rule)
    return _output(rule, names)


async def delete_rule(db: AsyncSession, user: User, rule_id: uuid.UUID) -> None:
    rule = await _own_rule(db, user, rule_id)
    await db.delete(rule)
    await db.commit()


async def rule_options(db: AsyncSession, user: User) -> RuleOptionsOutput:
    stores = await visible_stores(db, user)
    categories: list[ProductCategory] = []
    if stores:
        found = set(
            await db.scalars(
                select(CanonicalProduct.category)
                .distinct()
                .where(
                    CanonicalProduct.category.is_not(None),
                    CanonicalProduct.id.in_(
                        select(Listing.canonical_product_id).where(
                            Listing.store_id.in_([s.id for s in stores])
                        )
                    ),
                )
            )
        )
        categories = [c for c in ProductCategory if c in found]
    return RuleOptionsOutput(
        stores=[OptionStore(id=s.id, slug=s.slug, name=s.name) for s in stores],
        categories=categories,
        milestones=next_milestones(today_in_argentina()),
        max_rules=MAX_RULES,
    )


# --- Evaluation -----------------------------------------------------------------------


@dataclass
class Match:
    listing_id: uuid.UUID
    canonical_product_id: uuid.UUID | None
    product_name: str
    category: str | None
    store_name: str
    price_start: Decimal
    price_end: Decimal
    variation_pct: Decimal


@dataclass
class Evaluation:
    evaluated: bool
    devaluation_pct: Decimal | None
    matches: list[Match]


def _end_of(day: date) -> datetime:
    """First instant of the next day in Argentina: everything before it belongs to `day`."""
    return datetime.combine(day + timedelta(days=1), time.min, ZONE)


def window(rule: _RuleLike, today: date) -> tuple[date, date] | None:
    """(start, end) days to compare, or None if the rule is not evaluated today."""
    if rule.kind == AlertRuleKind.DEVALUATION:
        return today - timedelta(days=rule.period_days or 0), today
    if not rule.starts_on or not rule.ends_on:
        return None
    if not rule.starts_on <= today <= rule.ends_on + timedelta(days=1):
        return None
    # The base is the last price before the milestone: it shows whether the regular
    # price was raised before the discount.
    return rule.starts_on - timedelta(days=1), min(today, rule.ends_on)


async def _rate_on(db: AsyncSession, rate_type: RateType, day: date) -> Decimal | None:
    end = _end_of(day)
    return await db.scalar(
        select(ExchangeRate.sell)
        .where(
            ExchangeRate.type == rate_type,
            ExchangeRate.quoted_at < end,
            ExchangeRate.quoted_at >= end - timedelta(days=LOOKBACK_DAYS + 1),
        )
        .order_by(ExchangeRate.quoted_at.desc())
        .limit(1)
    )


async def _prices_on(
    db: AsyncSession, listing_ids: list[uuid.UUID], day: date
) -> dict[uuid.UUID, Price]:
    """Last available national price of each listing up to the end of `day`."""
    end = _end_of(day)
    rows = await db.scalars(
        select(Price)
        .ext(distinct_on(Price.listing_id))
        .where(
            Price.listing_id.in_(listing_ids),
            Price.location_id.is_(None),
            Price.available,
            Price.captured_at < end,
            Price.captured_at >= end - timedelta(days=LOOKBACK_DAYS + 1),
        )
        .order_by(Price.listing_id, Price.captured_at.desc())
    )
    return {price.listing_id: price for price in rows}


def _variation(start: Price, end: Price) -> Decimal | None:
    """Change of the regular price in %, per unit of content when both publish it."""
    before = start.regular_price or start.local_price
    after = end.regular_price or end.local_price
    if not before or not after:
        return None
    if start.grammage and end.grammage:
        if start.unit != end.unit:
            return None
        if start.grammage != end.grammage:
            before = before / start.grammage
            after = after / end.grammage
    elif start.grammage != end.grammage:
        # Content known on one side only: it may have changed, the comparison is not fair.
        return None
    return (after / before - 1) * 100


async def evaluate_rule(db: AsyncSession, rule: _RuleLike, user: User, today: date) -> Evaluation:
    """Devaluation of the period and the listings that rose more than the threshold above it."""
    days = window(rule, today)
    if days is None:
        return Evaluation(evaluated=False, devaluation_pct=None, matches=[])
    start, end = days

    stores = await visible_stores(db, user)
    store_ids = [s.id for s in stores]
    if rule.store_id is not None:
        # The user lost access to the rule's store: nothing to evaluate.
        store_ids = [rule.store_id] if rule.store_id in store_ids else []
    if not store_ids:
        return Evaluation(evaluated=True, devaluation_pct=None, matches=[])

    rate_start = await _rate_on(db, rule.rate_type, start)
    rate_end = await _rate_on(db, rule.rate_type, end)
    if not rate_start or not rate_end:
        return Evaluation(evaluated=True, devaluation_pct=None, matches=[])
    devaluation = (rate_end / rate_start - 1) * 100

    statement = (
        select(
            Listing.id,
            CanonicalProduct.id.label("product_id"),
            CanonicalProduct.name,
            CanonicalProduct.category,
            Store.name.label("store_name"),
        )
        .join(CanonicalProduct, CanonicalProduct.id == Listing.canonical_product_id)
        .join(Store, Store.id == Listing.store_id)
        .where(Listing.store_id.in_(store_ids))
    )
    if rule.scope == AlertRuleScope.PRODUCT:
        statement = statement.where(Listing.canonical_product_id == rule.canonical_product_id)
    else:
        statement = statement.where(CanonicalProduct.category == rule.category)
    listings = {row.id: row for row in await db.execute(statement)}

    matches = []
    if listings:
        before = await _prices_on(db, list(listings), start)
        after = await _prices_on(db, list(listings), end)
        for listing_id, row in listings.items():
            if listing_id not in before or listing_id not in after:
                continue
            variation = _variation(before[listing_id], after[listing_id])
            if variation is None or variation - devaluation <= rule.threshold_pp:
                continue
            matches.append(
                Match(
                    listing_id=listing_id,
                    canonical_product_id=row.product_id,
                    product_name=row.name,
                    category=row.category,
                    store_name=row.store_name,
                    price_start=before[listing_id].regular_price or before[listing_id].local_price,
                    price_end=after[listing_id].regular_price or after[listing_id].local_price,
                    variation_pct=variation.quantize(CENTS),
                )
            )
    matches.sort(key=lambda m: (-m.variation_pct, m.product_name, m.store_name))
    return Evaluation(evaluated=True, devaluation_pct=devaluation.quantize(CENTS), matches=matches)


async def preview_rule(db: AsyncSession, user: User, data: RuleConditions) -> RulePreviewOutput:
    rule = AlertRule(**data.model_dump())
    _normalize(rule)
    await _check_conditions(db, user, rule)
    result = await evaluate_rule(db, rule, user, today_in_argentina())
    return RulePreviewOutput(
        devaluation_pct=result.devaluation_pct,
        products_count=len(result.matches),
        stores_count=len({m.store_name for m in result.matches}),
        evaluated=result.evaluated,
        items=[
            PreviewItem(
                canonical_product_id=m.canonical_product_id,
                product_name=m.product_name,
                store_name=m.store_name,
                variation_pct=m.variation_pct,
            )
            for m in result.matches[:PREVIEW_ITEMS]
        ],
    )


# --- Daily run ------------------------------------------------------------------------


async def _fire(db: AsyncSession, rule: AlertRule, user: User, today: date) -> bool:
    """Evaluates one rule and stores the alert if it fires. Does not commit."""
    already = await db.scalar(
        select(FiredAlert.id).where(FiredAlert.rule_id == rule.id, FiredAlert.evaluated_on == today)
    )
    if already is not None:
        return False
    result = await evaluate_rule(db, rule, user, today)
    if not result.matches or result.devaluation_pct is None:
        return False

    recent = set(
        await db.scalars(
            select(FiredAlertItem.listing_id)
            .join(FiredAlert, FiredAlert.id == FiredAlertItem.fired_alert_id)
            .where(
                FiredAlert.rule_id == rule.id,
                FiredAlert.evaluated_on >= today - timedelta(days=REPEAT_DAYS),
            )
        )
    )
    matches = [m for m in result.matches if m.listing_id not in recent]
    if not matches:
        return False

    names = (await _names(db, [rule]))[rule.id]
    now = datetime.now(ZONE)
    alert = FiredAlert(
        rule_id=rule.id,
        user_id=rule.user_id,
        fired_at=now,
        evaluated_on=today,
        rule_name=rule.name,
        scope_label=scope_label(rule, names.product, names.store)[:200],
        phrase=fired_phrase(rule, names.product, names.store),
        devaluation_pct=result.devaluation_pct,
        average_pct=(sum(m.variation_pct for m in matches) / len(matches)).quantize(CENTS),
        products_count=len(matches),
        # Without the bell the alert stays in the inbox but does not ring.
        seen_at=None if rule.notify_in_app else now,
    )
    db.add(alert)
    await db.flush()
    db.add_all(
        FiredAlertItem(
            fired_alert_id=alert.id,
            listing_id=m.listing_id,
            canonical_product_id=m.canonical_product_id,
            product_name=m.product_name[:255],
            category=m.category,
            store_name=m.store_name[:120],
            price_start=m.price_start,
            price_end=m.price_end,
            variation_pct=m.variation_pct,
        )
        for m in matches
    )
    rule.last_fired_at = now
    return True


async def evaluate_all_rules(db: AsyncSession, today: date | None = None) -> dict[str, int]:
    """Evaluates every active rule of active users. One failing rule does not stop the rest."""
    today = today or today_in_argentina()
    rows = (
        await db.execute(
            select(AlertRule.id, AlertRule.user_id)
            .join(User, User.id == AlertRule.user_id)
            .where(AlertRule.active, User.status == UserStatus.ACTIVE)
            .order_by(AlertRule.created_at, AlertRule.id)
        )
    ).all()
    counts = {"evaluated": 0, "fired": 0, "errors": 0}
    # Ids first and objects inside each try: a rollback expires what was loaded before.
    for rule_id, user_id in rows:
        try:
            rule = await db.get(AlertRule, rule_id)
            user = await db.get(User, user_id)
            fired = await _fire(db, rule, user, today)
            await db.commit()
        except Exception:
            log.exception("Alert rule %s failed", rule_id)
            await db.rollback()
            counts["errors"] += 1
            continue
        counts["evaluated"] += 1
        counts["fired"] += int(fired)
    return counts


# --- Inbox ----------------------------------------------------------------------------


def _alert_output(alert: FiredAlert) -> FiredAlertOutput:
    return FiredAlertOutput(
        id=alert.id,
        rule_id=alert.rule_id,
        rule_name=alert.rule_name,
        fired_at=alert.fired_at,
        scope_label=alert.scope_label,
        phrase=alert.phrase,
        products_count=alert.products_count,
        devaluation_pct=alert.devaluation_pct,
        average_pct=alert.average_pct,
        seen=alert.seen_at is not None,
    )


async def list_alerts(
    db: AsyncSession, user: User, *, page: int, size: int, unseen: bool
) -> Page[FiredAlertOutput]:
    conditions = [FiredAlert.user_id == user.id]
    if unseen:
        conditions.append(FiredAlert.seen_at.is_(None))
    total = await db.scalar(select(func.count()).select_from(FiredAlert).where(*conditions))
    alerts = await db.scalars(
        select(FiredAlert)
        .where(*conditions)
        .order_by(FiredAlert.fired_at.desc(), FiredAlert.id)
        .offset((page - 1) * size)
        .limit(size)
    )
    return Page(items=[_alert_output(a) for a in alerts], total=total or 0, page=page, size=size)


async def _own_alert(db: AsyncSession, user: User, alert_id: uuid.UUID) -> FiredAlert:
    alert = await db.get(FiredAlert, alert_id)
    if alert is None or alert.user_id != user.id:
        raise NotFoundError("La alerta no existe")
    return alert


async def get_alert(db: AsyncSession, user: User, alert_id: uuid.UUID) -> FiredAlertDetailOutput:
    alert = await _own_alert(db, user, alert_id)
    items = await db.scalars(
        select(FiredAlertItem)
        .where(FiredAlertItem.fired_alert_id == alert.id)
        .order_by(FiredAlertItem.variation_pct.desc(), FiredAlertItem.product_name)
    )
    return FiredAlertDetailOutput(
        **_alert_output(alert).model_dump(),
        items=[FiredAlertItemOutput.model_validate(item) for item in items],
    )


async def mark_seen(db: AsyncSession, user: User, alert_id: uuid.UUID | None = None) -> None:
    """Marks one alert (or all of them) as seen. Idempotent."""
    if alert_id is not None:
        await _own_alert(db, user, alert_id)
    statement = (
        update(FiredAlert)
        .where(FiredAlert.user_id == user.id, FiredAlert.seen_at.is_(None))
        .values(seen_at=func.now())
    )
    if alert_id is not None:
        statement = statement.where(FiredAlert.id == alert_id)
    await db.execute(statement)
    await db.commit()


async def alerts_summary(db: AsyncSession, user: User) -> AlertsSummaryOutput:
    mine = FiredAlert.user_id == user.id
    unseen, total = (
        await db.execute(
            select(
                func.count().filter(FiredAlert.seen_at.is_(None)),
                func.count(),
            ).where(mine)
        )
    ).one()
    rules, active_rules = (
        await db.execute(
            select(func.count(), func.count().filter(AlertRule.active)).where(
                AlertRule.user_id == user.id
            )
        )
    ).one()
    since = datetime.now(ZONE) - timedelta(days=SUMMARY_DAYS)
    affected, max_gap = (
        await db.execute(
            select(
                func.coalesce(func.sum(FiredAlert.products_count), 0),
                func.max(FiredAlert.average_pct - FiredAlert.devaluation_pct),
            ).where(mine, FiredAlert.fired_at >= since)
        )
    ).one()
    return AlertsSummaryOutput(
        unseen=unseen,
        total=total,
        active_rules=active_rules,
        rules=rules,
        affected_products=affected,
        max_gap_pp=max_gap,
    )
