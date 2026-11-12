from datetime import UTC, datetime
from decimal import Decimal

from httpx import AsyncClient

from app.core.database import SessionLocal
from app.models import ExchangeRate, RateType
from tests.conftest import bearer


async def add_rate(rate_type: RateType, sell: str, quoted_at: datetime) -> None:
    async with SessionLocal() as db:
        db.add(
            ExchangeRate(
                source="dolarapi",
                type=rate_type,
                quoted_at=quoted_at,
                buy=Decimal(sell) - 20,
                sell=Decimal(sell),
            )
        )
        await db.commit()


async def test_latest_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/rates/latest")).status_code == 401
    assert (await client.get("/api/v1/rates/history")).status_code == 401


async def test_latest_returns_newest_of_each_type_and_gap(
    client: AsyncClient, client_token: str
) -> None:
    old = datetime(2026, 11, 10, 12, tzinfo=UTC)
    new = datetime(2026, 11, 11, 12, tzinfo=UTC)
    await add_rate(RateType.OFFICIAL, "1400", old)
    await add_rate(RateType.OFFICIAL, "1450", new)
    await add_rate(RateType.BLUE, "1500", new)

    response = await client.get("/api/v1/rates/latest", headers=bearer(client_token))

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["official"]["sell"]) == Decimal("1450")
    assert Decimal(body["blue"]["sell"]) == Decimal("1500")
    assert body["official"]["source"] == "dolarapi"
    assert Decimal(body["gap_pct"]) == Decimal("3.45")


async def test_latest_without_rates(client: AsyncClient, client_token: str) -> None:
    response = await client.get("/api/v1/rates/latest", headers=bearer(client_token))
    assert response.json() == {"official": None, "blue": None, "gap_pct": None}


async def test_history_keeps_last_rate_of_each_argentine_day(
    client: AsyncClient, client_token: str
) -> None:
    # 10/11 09:00 and 23:30 in Argentina (UTC-3); the second one is 02:30 UTC of 11/11.
    await add_rate(RateType.BLUE, "1500", datetime(2026, 11, 10, 12, tzinfo=UTC))
    await add_rate(RateType.BLUE, "1510", datetime(2026, 11, 11, 2, 30, tzinfo=UTC))
    await add_rate(RateType.BLUE, "1520", datetime(2026, 11, 11, 15, tzinfo=UTC))
    await add_rate(RateType.OFFICIAL, "1400", datetime(2026, 11, 11, 15, tzinfo=UTC))
    # Outside the range.
    await add_rate(RateType.BLUE, "1300", datetime(2026, 10, 1, 15, tzinfo=UTC))

    response = await client.get(
        "/api/v1/rates/history",
        params={"type": "blue", "start": "2026-11-10", "end": "2026-11-11"},
        headers=bearer(client_token),
    )

    assert response.status_code == 200
    assert [(p["date"], Decimal(p["sell"])) for p in response.json()] == [
        ("2026-11-10", Decimal("1510")),
        ("2026-11-11", Decimal("1520")),
    ]


async def test_history_rejects_invalid_ranges(client: AsyncClient, client_token: str) -> None:
    headers = bearer(client_token)
    reversed_range = {"start": "2026-11-11", "end": "2026-11-10"}
    too_long = {"start": "2025-01-01", "end": "2026-11-10"}
    for params in (reversed_range, too_long, {"type": "euro"}):
        response = await client.get("/api/v1/rates/history", params=params, headers=headers)
        assert response.status_code == 422, params
