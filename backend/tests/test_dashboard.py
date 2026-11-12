from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, update

from app.core.database import SessionLocal
from app.models import CanonicalProduct, ExchangeRate, Price, ProductCategory, RateType
from tests.conftest import bearer
from tests.test_products import add_listing, add_store, client_with, price

URL = "/api/v1/dashboard"
START = date(2026, 10, 1)
END = date(2026, 10, 31)
RISE = date(2026, 10, 21)


def noon(day: date) -> datetime:
    """12:00 in Argentina, far from the day boundary."""
    return datetime.combine(day, time(15), UTC)


def every_day(start: date = START, end: date = END) -> list[date]:
    return [start + timedelta(days=n) for n in range((end - start).days + 1)]


def rate(day: date, sell: str, rate_type: RateType = RateType.BLUE) -> ExchangeRate:
    return ExchangeRate(
        source="test",
        type=rate_type,
        quoted_at=noon(day),
        buy=Decimal(sell),
        sell=Decimal(sell),
        source_date=noon(day),
    )


@pytest.fixture
async def market() -> dict:
    """October 2026, a price every day.

    - Coffee at Carrefour: 1000 → 1100 on the 21st, with a promo (700) on the 10th–12th.
    - Coffee at Jumbo: always 1000, but 500 g → 450 g on the 21st (shrinkflation).
    - Soda at Carrefour: always 500.
    - Blue rate: 1000 on the 1st, 1100 on the 31st.
    """
    async with SessionLocal() as db:
        carrefour = await add_store(db, "carrefour")
        jumbo = await add_store(db, "jumbo")
        coffee = CanonicalProduct(
            ean="07790000000401", name="Café molido 500 g", category=ProductCategory.ALMACEN
        )
        soda = CanonicalProduct(
            ean="07790000000999", name="Gaseosa 2,25 L", category=ProductCategory.BEBIDAS
        )
        db.add_all([coffee, soda])
        await db.flush()
        coffee_c = await add_listing(db, carrefour, coffee, "c1")
        coffee_j = await add_listing(db, jumbo, coffee, "j1")
        soda_c = await add_listing(db, carrefour, soda, "c2")

        for day in every_day():
            later = day >= RISE
            if date(2026, 10, 10) <= day <= date(2026, 10, 12):
                db.add(price(coffee_c, noon(day), "700", regular="1000", is_promo=True))
            else:
                db.add(price(coffee_c, noon(day), "1100" if later else "1000"))
            db.add(
                price(
                    coffee_j, noon(day), "1000", grammage=Decimal(450 if later else 500), unit="g"
                )
            )
            db.add(price(soda_c, noon(day), "500"))
        db.add_all([rate(START, "1000"), rate(END, "1100"), rate(START, "900", RateType.OFFICIAL)])
        await db.commit()
        return {"stores": [carrefour, jumbo], "listings": [coffee_c, coffee_j, soda_c]}


def params(**extra: str) -> dict:
    return {"start": START.isoformat(), "end": END.isoformat()} | extra


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401
    assert (await client.get(f"{URL}/options")).status_code == 401


async def test_index_ignores_promos_and_counts_shrinkflation(
    client: AsyncClient, market: dict
) -> None:
    headers = await client_with(client, market["stores"])
    response = await client.get(URL, params=params(), headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["start"] == "2026-10-01"
    assert body["end"] == "2026-10-31"
    summary = body["summary"]
    rows = {row["category"]: row for row in summary["rows"]}
    # Carrefour +10 %, Jumbo +11.1 % per gram: geometric mean.
    assert rows["almacen"]["ars"] == pytest.approx(10.55, abs=0.01)
    assert rows["bebidas"]["ars"] == 0
    assert [row["category"] for row in summary["rows"]] == ["almacen", "bebidas"]
    assert rows["almacen"]["products"] == 1

    assert summary["days"] == 30
    assert summary["products"] == 2
    assert summary["ars"] == pytest.approx(5.28, abs=0.01)
    assert summary["rate_from"] == 1000
    assert summary["rate_to"] == 1100
    assert summary["devaluation"] == 10
    assert summary["gap"] == pytest.approx(-4.72, abs=0.01)
    assert summary["usd"] == pytest.approx(-4.29, abs=0.01)
    assert rows["almacen"]["gap"] == pytest.approx(0.55, abs=0.01)


async def test_series_scatter_and_peaks(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, market["stores"])
    body = (await client.get(URL, params=params(), headers=headers)).json()

    series = body["series"]
    assert len(series) == 31
    assert series[0]["ars"] == 100
    assert series[0]["usd"] == 100
    # The promo days do not move the index.
    assert series[11]["categories"]["almacen"] == 100
    assert series[-1]["categories"]["almacen"] == pytest.approx(110.55, abs=0.01)
    assert series[15]["rate"] == 1000  # carried from the 1st
    assert series[-1]["usd"] == pytest.approx(series[-1]["ars"] / 1.1, abs=0.01)

    scatter = {point["category"]: point for point in body["scatter"]}
    assert scatter["almacen"]["month"] == "2026-10"
    assert scatter["almacen"]["fx"] == 10

    assert body["peaks"] == [
        {"category": "almacen", "date": "2026-10-21", "value": pytest.approx(10.55, abs=0.01)}
    ]


async def test_official_rate(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, market["stores"])
    body = (await client.get(URL, params=params(rate="official"), headers=headers)).json()
    assert body["rate"] == "official"
    assert body["summary"]["devaluation"] == 0
    assert body["scatter"][0]["fx"] == 0


async def test_store_and_category_filters(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, market["stores"])

    jumbo = (await client.get(URL, params=params(stores="jumbo"), headers=headers)).json()
    assert [row["category"] for row in jumbo["summary"]["rows"]] == ["almacen"]
    assert jumbo["summary"]["ars"] == pytest.approx(11.11, abs=0.01)

    drinks = (await client.get(URL, params=params(categories="bebidas"), headers=headers)).json()
    assert [row["category"] for row in drinks["summary"]["rows"]] == ["bebidas"]
    assert list(drinks["series"][0]["categories"]) == ["bebidas"]


async def test_only_visible_stores(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, [market["stores"][1]])  # only Jumbo
    body = (await client.get(URL, params=params(stores="carrefour"), headers=headers)).json()
    assert body["summary"] is None
    assert body["series"] == []


async def test_scraping_errors_are_skipped(client: AsyncClient, market: dict) -> None:
    async with SessionLocal() as db:
        soda = market["listings"][2]
        # A price ten times higher for a day: taken as an error both ways.
        await db.merge(price(soda, noon(date(2026, 10, 5)), "5000"))
        await db.commit()
    headers = await client_with(client, market["stores"])
    body = (await client.get(URL, params=params(categories="bebidas"), headers=headers)).json()
    assert body["summary"]["ars"] == 0


async def test_listing_leaves_after_a_week_without_prices(
    client: AsyncClient, market: dict
) -> None:
    soda = market["listings"][2]
    async with SessionLocal() as db:
        # No soda from the 10th to the 20th; it comes back at 600 on the 21st.
        await db.execute(
            delete(Price).where(
                Price.listing_id == soda.id,
                Price.captured_at >= noon(date(2026, 10, 10)),
                Price.captured_at <= noon(date(2026, 10, 20)),
            )
        )
        await db.execute(
            update(Price)
            .where(Price.listing_id == soda.id, Price.captured_at >= noon(RISE))
            .values(local_price=Decimal(600), regular_price=Decimal(600))
        )
        await db.commit()
    headers = await client_with(client, market["stores"])
    body = (await client.get(URL, params=params(categories="bebidas"), headers=headers)).json()
    # 11 days without a price: 500 → 600 is not compared, the index stays flat.
    assert body["summary"]["ars"] == 0


async def test_empty_range(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, market["stores"])
    body = (
        await client.get(URL, params={"start": "2025-01-01", "end": "2025-02-01"}, headers=headers)
    ).json()
    assert body["summary"] is None
    assert body["peaks"] == []


@pytest.mark.parametrize(
    "query",
    [
        {"start": "2026-10-31", "end": "2026-10-01"},
        {"start": "2025-01-01", "end": "2026-10-31"},
        {"categories": "almacen,juguetes"},
        {"rate": "tarjeta"},
    ],
)
async def test_invalid_parameters(client: AsyncClient, admin_token: str, query: dict) -> None:
    response = await client.get(URL, params=query, headers=bearer(admin_token))
    assert response.status_code == 422


async def test_options(client: AsyncClient, market: dict) -> None:
    headers = await client_with(client, [market["stores"][1]])  # only Jumbo
    body = (await client.get(f"{URL}/options", headers=headers)).json()
    assert body == {
        "stores": [{"slug": "jumbo", "name": "Jumbo"}],
        "categories": ["almacen"],
        "min_date": "2026-10-01",
        "max_date": "2026-10-31",
    }


async def test_options_without_stores(client: AsyncClient, client_token: str) -> None:
    body = (await client.get(f"{URL}/options", headers=bearer(client_token))).json()
    assert body == {"stores": [], "categories": [], "min_date": None, "max_date": None}
