"""Operation screen: state of the scheduled scrapers, their errors and manual runs.

Everything is read from `scraping_runs`. A failed run becomes an entry of the error
log; it is a warning instead of an error when a later run of the same store
succeeded (a retry fixed it).
"""

import re
import statistics
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ExchangeRate, ScrapingRun, Store
from app.schemas.operation import (
    EnqueueOutput,
    ErrorKind,
    LastRun,
    OperationError,
    OperationOverview,
    RatesStatus,
    Severity,
    StoreOverview,
    TrendPoint,
)
from app.services.errors import BusinessError, ConflictError, NotFoundError
from app.services.mail import TaskQueue
from app.services.rates import BUSINESS_TIME_ZONE

ZONE = ZoneInfo(BUSINESS_TIME_ZONE)

# Daily scraping jobs: store slug → (ARQ function, hour, minute in UTC).
# The worker cron (workers/tasks.py) and this screen read the same table.
DAILY_SCRAPES: dict[str, tuple[str, int, int]] = {
    "carrefour": ("scrape_carrefour", 9, 0),
    "jumbo": ("scrape_jumbo", 9, 30),
}
TREND_DAYS = 7
EXPECTED_RUNS = 7
RATES_FRESH = timedelta(hours=2)


class ServiceUnavailableError(BusinessError):
    status_code = 503


def schedule_label(slug: str) -> str | None:
    if slug not in DAILY_SCRAPES:
        return None
    _, hour, minute = DAILY_SCRAPES[slug]
    local = datetime.combine(date.today(), time(hour, minute), UTC).astimezone(ZONE)
    return f"Diario {local:%H:%M}"


def next_run_at(slug: str, now: datetime) -> datetime | None:
    if slug not in DAILY_SCRAPES:
        return None
    _, hour, minute = DAILY_SCRAPES[slug]
    today = datetime.combine(now.astimezone(UTC).date(), time(hour, minute), UTC)
    return today if today > now else today + timedelta(days=1)


def can_enqueue(slug: str) -> bool:
    return (
        slug in DAILY_SCRAPES
        and settings.scraping_enabled
        and settings.scraping_jobs_enabled
        and slug in settings.scraping_allowed_stores
    )


async def overview(db: AsyncSession, now: datetime | None = None) -> OperationOverview:
    now = now or datetime.now(UTC)
    stores = list(
        await db.scalars(select(Store).where(Store.active.is_(True)).order_by(Store.name))
    )
    store_ids = [s.id for s in stores]

    last_runs = {
        run.store_id: run
        for run in await db.scalars(
            select(ScrapingRun)
            .ext(distinct_on(ScrapingRun.store_id))
            .where(ScrapingRun.store_id.in_(store_ids))
            .order_by(ScrapingRun.store_id, ScrapingRun.started_at.desc())
        )
    }
    last_success = dict(
        (
            await db.execute(
                select(ScrapingRun.store_id, func.max(ScrapingRun.finished_at))
                .where(ScrapingRun.store_id.in_(store_ids), ScrapingRun.status == "success")
                .group_by(ScrapingRun.store_id)
            )
        ).all()
    )

    # Last 7 successful runs of each store, for the expected amount.
    ranked = (
        select(
            ScrapingRun.store_id,
            ScrapingRun.observations_saved,
            func.row_number()
            .over(partition_by=ScrapingRun.store_id, order_by=ScrapingRun.started_at.desc())
            .label("n"),
        )
        .where(ScrapingRun.store_id.in_(store_ids), ScrapingRun.status == "success")
        .subquery()
    )
    recent: dict[uuid.UUID, list[int]] = {}
    for store_id, saved in await db.execute(
        select(ranked.c.store_id, ranked.c.observations_saved).where(ranked.c.n <= EXPECTED_RUNS)
    ):
        recent.setdefault(store_id, []).append(saved)

    today = now.astimezone(ZONE).date()
    first_day = today - timedelta(days=TREND_DAYS - 1)
    local_day = cast(func.timezone(BUSINESS_TIME_ZONE, ScrapingRun.started_at), Date)
    per_day: dict[tuple[uuid.UUID, date], int] = {
        (store_id, day): total
        for store_id, day, total in await db.execute(
            select(ScrapingRun.store_id, local_day, func.max(ScrapingRun.observations_saved))
            .where(
                ScrapingRun.store_id.in_(store_ids),
                ScrapingRun.status == "success",
                ScrapingRun.started_at >= datetime.combine(first_day, time.min, ZONE),
            )
            .group_by(ScrapingRun.store_id, local_day)
        )
    }
    days = [first_day + timedelta(days=n) for n in range(TREND_DAYS)]

    last_rate, source = (
        await db.execute(
            select(ExchangeRate.quoted_at, ExchangeRate.source)
            .order_by(ExchangeRate.quoted_at.desc())
            .limit(1)
        )
    ).one_or_none() or (None, None)
    # Each ingestion stores official and blue with the same quoted_at.
    ingestions = await db.scalar(
        select(func.count(func.distinct(ExchangeRate.quoted_at))).where(
            ExchangeRate.quoted_at >= now - timedelta(hours=24)
        )
    )

    return OperationOverview(
        stores=[
            StoreOverview(
                store_slug=store.slug,
                store_name=store.name,
                schedule=schedule_label(store.slug),
                next_run_at=next_run_at(store.slug, now),
                last_run=(
                    LastRun.model_validate(last_runs[store.id], from_attributes=True)
                    if store.id in last_runs
                    else None
                ),
                last_success_at=last_success.get(store.id),
                expected=int(statistics.median(recent[store.id])) if store.id in recent else None,
                trend_7d=[
                    TrendPoint(date=day, products=per_day.get((store.id, day), 0)) for day in days
                ],
                can_enqueue=can_enqueue(store.slug),
            )
            for store in stores
        ],
        rates=RatesStatus(
            last_quoted_at=last_rate,
            ok=last_rate is not None and now - last_rate <= RATES_FRESH,
            source=source,
            ingestions_24h=ingestions or 0,
        ),
    )


# --- Error log ------------------------------------------------------------------------

_STATUS = re.compile(r"status:?\s*(\d{3})", re.IGNORECASE)


def classify(code: str | None, message: str | None) -> tuple[ErrorKind, str]:
    """Kind of failure and a message for the admin, from what the run stored."""
    text = message or ""
    if code == "RUN_INTERRUPTED":
        return "interrupted", "La ejecución quedó colgada y se marcó como fallida."
    match = _STATUS.search(text)
    if match:
        status = int(match.group(1))
        if status in (401, 403, 429):
            return "block", f"La tienda rechazó la consulta (HTTP {status})."
        if status >= 500:
            return "server", f"El sitio de la tienda respondió con error (HTTP {status})."
        return "other", f"Respuesta inesperada de la tienda (HTTP {status})."
    if "Timeout" in text:
        return "timeout", "La tienda no respondió a tiempo."
    if text.startswith("Network error") or "network error" in text:
        return "network", "No se pudo conectar con la tienda."
    if "invalid" in text.lower() or "JSON" in text:
        return "markup", "La tienda devolvió datos con un formato inesperado."
    return "other", "La extracción falló por un error interno."


def _duration(run: ScrapingRun) -> str:
    if run.finished_at is None:
        return "—"
    seconds = int((run.finished_at - run.started_at).total_seconds())
    return f"{seconds // 60} min {seconds % 60} s" if seconds >= 60 else f"{seconds} s"


async def errors(
    db: AsyncSession,
    *,
    hours: int,
    store_slug: str | None,
    kind: ErrorKind | None,
    now: datetime | None = None,
) -> list[OperationError]:
    now = now or datetime.now(UTC)
    conditions = [
        ScrapingRun.status == "failed",
        ScrapingRun.started_at >= now - timedelta(hours=hours),
    ]
    if store_slug:
        conditions.append(Store.slug == store_slug)
    failed = (
        await db.execute(
            select(ScrapingRun, Store)
            .join(Store, Store.id == ScrapingRun.store_id)
            .where(*conditions)
            .order_by(ScrapingRun.started_at.desc(), ScrapingRun.id)
        )
    ).all()
    if not failed:
        return []

    # First successful run after each failure, if any: the failure was resolved.
    successes: dict[uuid.UUID, list[datetime]] = {}
    for store_id, started_at in await db.execute(
        select(ScrapingRun.store_id, ScrapingRun.started_at)
        .where(
            ScrapingRun.status == "success",
            ScrapingRun.store_id.in_({run.store_id for run, _ in failed}),
            ScrapingRun.started_at >= min(run.started_at for run, _ in failed),
        )
        .order_by(ScrapingRun.started_at)
    ):
        successes.setdefault(store_id, []).append(started_at)

    entries = []
    for run, store in failed:
        entry_kind, message = classify(run.error_code, run.error_message)
        if kind is not None and entry_kind != kind:
            continue
        fixed = next((t for t in successes.get(run.store_id, []) if t > run.started_at), None)
        severity: Severity = "warning" if fixed else "error"
        detail = [
            f"{run.error_code or 'ERROR'}: {run.error_message or 'sin detalle'}",
            f"  búsqueda: {run.search_mode} = {run.search_value or '—'}",
            f"  duración: {_duration(run)}",
        ]
        if fixed:
            detail.append(f"  resuelto: ejecución exitosa del {fixed.astimezone(ZONE):%d/%m %H:%M}")
        entries.append(
            OperationError(
                id=run.id,
                date=run.finished_at or run.started_at,
                store_slug=store.slug,
                store_name=store.name,
                kind=entry_kind,
                severity=severity,
                message=message
                if not fixed
                else f"{message} Se resolvió en una ejecución posterior.",
                detail="\n".join(detail),
            )
        )
    return entries


# --- Manual runs ----------------------------------------------------------------------


async def enqueue(db: AsyncSession, queue: TaskQueue, slug: str) -> EnqueueOutput:
    """Queue the store's daily job now, the same one the cron runs."""
    store = await db.scalar(select(Store).where(Store.slug == slug, Store.active.is_(True)))
    if store is None:
        raise NotFoundError("La tienda no existe o está inactiva")
    if not can_enqueue(slug):
        raise ServiceUnavailableError(
            "La extracción programada no está habilitada para esta tienda"
        )
    running = await db.scalar(
        select(ScrapingRun.id).where(
            ScrapingRun.store_id == store.id, ScrapingRun.status == "running"
        )
    )
    if running is not None:
        raise ConflictError("Ya hay una extracción en curso para esta tienda")
    now = datetime.now(UTC)
    function = DAILY_SCRAPES[slug][0]
    # One manual job per store and minute: double clicks do not queue twice.
    await queue.enqueue_job(function, _job_id=f"manual:{function}:{now:%Y%m%d%H%M}")
    return EnqueueOutput(store_slug=slug, queued_at=now)
