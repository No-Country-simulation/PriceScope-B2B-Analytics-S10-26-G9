import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx
from sqlalchemy import Date, cast, func, select
from sqlalchemy.dialects.postgresql import distinct_on, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExchangeRate, RateType

log = logging.getLogger(__name__)

URL_DOLARAPI = "https://dolarapi.com/v1/dolares/{casa}"
URL_BLUELYTICS = "https://api.bluelytics.com.ar/v2/latest"

# The external APIs name each rate type with these keys.
EXTERNAL_KEYS = {RateType.OFFICIAL: "oficial", RateType.BLUE: "blue"}


class SourceError(Exception):
    """No rate source answered correctly."""


@dataclass(frozen=True)
class RateReading:
    source: str
    type: RateType
    buy: Decimal | None
    sell: Decimal
    source_date: datetime | None


def _dec(value: object) -> Decimal:
    return Decimal(str(value))


async def _read_dolarapi(client: httpx.AsyncClient) -> list[RateReading]:
    readings = []
    for rate_type in RateType:
        response = await client.get(URL_DOLARAPI.format(casa=EXTERNAL_KEYS[rate_type]))
        response.raise_for_status()
        data = response.json()
        readings.append(
            RateReading(
                source="dolarapi",
                type=rate_type,
                buy=_dec(data["compra"]),
                sell=_dec(data["venta"]),
                source_date=datetime.fromisoformat(data["fechaActualizacion"]),
            )
        )
    return readings


async def _read_bluelytics(client: httpx.AsyncClient) -> list[RateReading]:
    response = await client.get(URL_BLUELYTICS)
    response.raise_for_status()
    data = response.json()
    source_date = datetime.fromisoformat(data["last_update"])
    return [
        RateReading(
            source="bluelytics",
            type=rate_type,
            buy=_dec(data[EXTERNAL_KEYS[rate_type]]["value_buy"]),
            sell=_dec(data[EXTERNAL_KEYS[rate_type]]["value_sell"]),
            source_date=source_date,
        )
        for rate_type in RateType
    ]


SOURCES = (("dolarapi", _read_dolarapi), ("bluelytics", _read_bluelytics))


async def fetch_rates(client: httpx.AsyncClient) -> list[RateReading]:
    """Tries the sources in order and returns the first one that answers correctly."""
    for name, read in SOURCES:
        try:
            return await read(client)
        except (httpx.HTTPError, KeyError, ValueError, ArithmeticError) as exc:
            log.warning("Rate source %s failed: %s", name, exc)
    raise SourceError("Ninguna fuente de cotizaciones respondió")


async def ingest_rates(db: AsyncSession, client: httpx.AsyncClient) -> int:
    """Fetches the source and stores official and blue with the same quoted_at.
    Returns how many rows were stored."""
    readings = await fetch_rates(client)
    now = datetime.now(UTC)
    rows = [
        {
            "source": reading.source,
            "type": reading.type,
            "quoted_at": now,
            "buy": reading.buy,
            "sell": reading.sell,
            "source_date": reading.source_date,
        }
        for reading in readings
    ]
    await db.execute(insert(ExchangeRate).values(rows).on_conflict_do_nothing())
    await db.commit()
    return len(rows)


async def latest_rates(db: AsyncSession) -> list[ExchangeRate]:
    """The most recent rate of each type."""
    rows = await db.scalars(
        select(ExchangeRate)
        .ext(distinct_on(ExchangeRate.type))
        .order_by(ExchangeRate.type, ExchangeRate.quoted_at.desc())
    )
    return list(rows)


# Days are cut in Argentina time: a rate quoted at 22:00 local belongs to that day.
BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires"
MAX_HISTORY_DAYS = 366


def gap_pct(official: Decimal | None, blue: Decimal | None) -> Decimal | None:
    """How much the blue rate is above the official, in %, with two decimals."""
    if not official or blue is None:
        return None
    return ((blue - official) / official * 100).quantize(Decimal("0.01"))


async def rate_history(
    db: AsyncSession, rate_type: RateType, start: date, end: date
) -> list[tuple[date, Decimal]]:
    """Last sell rate of each day between start and end (inclusive), in Argentina time.

    Days without quotes are skipped; the client decides how to draw the gap.
    """
    local_day = cast(func.timezone(BUSINESS_TIME_ZONE, ExchangeRate.quoted_at), Date)
    rows = await db.execute(
        select(local_day.label("day"), ExchangeRate.sell)
        .where(
            ExchangeRate.type == rate_type,
            # Wide UTC window (± 1 day), then filtered by the local day.
            ExchangeRate.quoted_at
            >= datetime.combine(start - timedelta(days=1), datetime.min.time(), UTC),
            ExchangeRate.quoted_at
            < datetime.combine(end + timedelta(days=2), datetime.min.time(), UTC),
            local_day.between(start, end),
        )
        .ext(distinct_on(local_day))
        .order_by(local_day, ExchangeRate.quoted_at.desc())
    )
    return [(row.day, row.sell) for row in rows]
