from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.core.database import SessionLocal
from app.models import (
    AlertRule,
    AlertRuleKind,
    AlertRuleScope,
    CanonicalProduct,
    ExchangeRate,
    FiredAlert,
    ProductCategory,
    RateType,
    User,
    UserStatus,
)
from app.services import alerts
from app.workers import tasks
from tests.conftest import bearer, create_active_user, login
from tests.test_products import add_listing, add_store, client_with, price

RULES = "/api/v1/alert-rules"
ALERTS = "/api/v1/alerts"
TODAY = alerts.today_in_argentina()
START = TODAY - timedelta(days=30)


def noon(day: date) -> datetime:
    """12:00 in Argentina, far from the day boundary."""
    return datetime.combine(day, time(15), UTC)


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
    """30 days ago → today. Blue 1000 → 1100 (+10 %), official flat.

    - Coffee (Almacén): Carrefour 1000 → 1200 (today on promo at 900), Jumbo 1000 → 1050.
    - Yerba (Almacén): Jumbo 1000 for 500 g → 1000 for 450 g (+11.1 % per gram).
    - Soda (Bebidas): Carrefour 500 → 500.
    - Hidden store, not assigned to the user: coffee 1000 → 2000 and a product of its own.
    """
    async with SessionLocal() as db:
        carrefour = await add_store(db, "carrefour")
        jumbo = await add_store(db, "jumbo")
        hidden = await add_store(db, "hidden")
        coffee = CanonicalProduct(
            ean="07790000000401", name="Café molido 500 g", category=ProductCategory.ALMACEN
        )
        yerba = CanonicalProduct(
            ean="07790000000770", name="Yerba mate 500 g", category=ProductCategory.ALMACEN
        )
        soda = CanonicalProduct(
            ean="07790000000999", name="Gaseosa 2,25 L", category=ProductCategory.BEBIDAS
        )
        secret = CanonicalProduct(
            ean="07790000000111", name="Solo en hidden", category=ProductCategory.ALMACEN
        )
        db.add_all([coffee, yerba, soda, secret])
        await db.flush()

        coffee_c = await add_listing(db, carrefour, coffee, "c1")
        coffee_j = await add_listing(db, jumbo, coffee, "j1")
        yerba_j = await add_listing(db, jumbo, yerba, "j2")
        soda_c = await add_listing(db, carrefour, soda, "c2")
        coffee_h = await add_listing(db, hidden, coffee, "h1")
        secret_h = await add_listing(db, hidden, secret, "h2")
        db.add_all(
            [
                price(coffee_c, noon(START), "1000"),
                price(coffee_c, noon(TODAY), "900", regular="1200", is_promo=True),
                price(coffee_j, noon(START), "1000"),
                price(coffee_j, noon(TODAY), "1050"),
                price(yerba_j, noon(START), "1000", grammage=Decimal(500), unit="g"),
                price(yerba_j, noon(TODAY), "1000", grammage=Decimal(450), unit="g"),
                price(soda_c, noon(START), "500"),
                price(soda_c, noon(TODAY), "500"),
                price(coffee_h, noon(START), "1000"),
                price(coffee_h, noon(TODAY), "2000"),
                price(secret_h, noon(START), "1000"),
                price(secret_h, noon(TODAY), "1000"),
                rate(START, "1000"),
                rate(TODAY, "1100"),
                rate(START, "1000", RateType.OFFICIAL),
                rate(TODAY, "1000", RateType.OFFICIAL),
            ]
        )
        await db.commit()
        return {
            "stores": {"carrefour": carrefour, "jumbo": jumbo, "hidden": hidden},
            "products": {"coffee": coffee, "yerba": yerba, "secret": secret},
        }


@pytest.fixture
async def headers(client: AsyncClient, market: dict) -> dict[str, str]:
    stores = market["stores"]
    return await client_with(client, [stores["carrefour"], stores["jumbo"]])


def body(**extra: object) -> dict:
    return {
        "name": "Almacén supera al blue",
        "kind": "devaluation",
        "scope": "category",
        "category": "almacen",
        "rate_type": "blue",
        "threshold_pp": 2,
        "period_days": 30,
    } | extra


async def other_user(client: AsyncClient) -> dict[str, str]:
    await create_active_user("otro@example.com")
    return bearer(await login(client, "otro@example.com"))


# --- Rules ----------------------------------------------------------------------------


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(RULES)).status_code == 401
    assert (await client.get(ALERTS)).status_code == 401


async def test_rule_crud(client: AsyncClient, headers: dict) -> None:
    created = await client.post(RULES, json=body(), headers=headers)
    assert created.status_code == 201, created.text
    rule = created.json()
    assert rule["active"] is True
    assert rule["last_fired_at"] is None
    assert rule["phrase"] == (
        "Avisame cuando un producto de Almacén en cualquier tienda suba más de 2 p.p. "
        "por encima del dólar blue en los últimos 30 días."
    )

    url = f"{RULES}/{rule['id']}"
    assert [r["id"] for r in (await client.get(RULES, headers=headers)).json()] == [rule["id"]]
    assert (await client.get(url, headers=headers)).json()["name"] == "Almacén supera al blue"

    paused = await client.patch(url, json={"active": False}, headers=headers)
    assert paused.json()["active"] is False

    edited = await client.patch(
        url, json={"threshold_pp": "2.5", "rate_type": "official"}, headers=headers
    )
    assert edited.status_code == 200, edited.text
    assert "2,5 p.p." in edited.json()["phrase"]
    assert "dólar oficial" in edited.json()["phrase"]

    assert (await client.delete(url, headers=headers)).status_code == 204
    assert (await client.get(RULES, headers=headers)).json() == []
    assert (await client.get(url, headers=headers)).status_code == 404


async def test_product_rule_in_one_store(client: AsyncClient, headers: dict, market: dict) -> None:
    jumbo = market["stores"]["jumbo"]
    coffee = market["products"]["coffee"]
    response = await client.post(
        RULES,
        json=body(
            scope="product",
            category=None,
            canonical_product_id=str(coffee.id),
            store_id=str(jumbo.id),
        ),
        headers=headers,
    )
    assert response.status_code == 201, response.text
    rule = response.json()
    assert rule["product_name"] == "Café molido 500 g"
    assert rule["store_name"] == "Jumbo"
    assert rule["phrase"].startswith("Avisame cuando Café molido 500 g en Jumbo suba")


async def test_editing_the_scope_clears_the_other_target(
    client: AsyncClient, headers: dict, market: dict
) -> None:
    rule = (await client.post(RULES, json=body(), headers=headers)).json()
    coffee = market["products"]["coffee"]
    response = await client.patch(
        f"{RULES}/{rule['id']}",
        json={"scope": "product", "canonical_product_id": str(coffee.id)},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["category"] is None


@pytest.mark.parametrize(
    ("extra", "status", "detail"),
    [
        ({"name": "  "}, 422, "Ponele un nombre a la regla."),
        ({"name": "x" * 81}, 422, "Ponele un nombre a la regla."),
        ({"threshold_pp": -1}, 422, "Ingresá un número igual o mayor a 0."),
        ({"period_days": 15}, 422, "Elegí un período de 7, 30 o 90 días."),
        ({"category": None}, 422, "Elegí una categoría."),
        (
            {"kind": "milestone", "starts_on": "2026-11-09", "ends_on": "2026-11-03"},
            422,
            "Revisá el rango: la fecha “hasta” no puede ser anterior a “desde”.",
        ),
        ({"store": "hidden"}, 400, "Esa tienda no está asignada a tu cuenta."),
        ({"product": "secret"}, 400, "Ese producto no está en tus tiendas."),
        ({"notify_email": True}, 400, "El aviso por correo todavía no está disponible."),
    ],
)
async def test_rule_validations(
    client: AsyncClient, headers: dict, market: dict, extra: dict, status: int, detail: str
) -> None:
    if "store" in extra:
        extra = {"store_id": str(market["stores"][extra.pop("store")].id)}
    if "product" in extra:
        product = market["products"][extra.pop("product")]
        extra = {"scope": "product", "category": None, "canonical_product_id": str(product.id)}
    response = await client.post(RULES, json=body(**extra), headers=headers)
    assert response.status_code == status, response.text
    assert response.json()["detail"] == detail


async def test_rule_limit(client: AsyncClient, headers: dict) -> None:
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == "cliente@example.com"))
        db.add_all(
            AlertRule(
                user_id=user.id,
                name=f"Regla {n}",
                kind=AlertRuleKind.DEVALUATION,
                scope=AlertRuleScope.CATEGORY,
                category="almacen",
                rate_type=RateType.BLUE,
                threshold_pp=Decimal(2),
                period_days=30,
            )
            for n in range(alerts.MAX_RULES)
        )
        await db.commit()
    response = await client.post(RULES, json=body(), headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Llegaste al máximo de 50 reglas."


async def test_rules_of_another_user_are_404(client: AsyncClient, headers: dict) -> None:
    rule = (await client.post(RULES, json=body(), headers=headers)).json()
    other = await other_user(client)
    url = f"{RULES}/{rule['id']}"
    assert (await client.get(url, headers=other)).status_code == 404
    assert (await client.patch(url, json={"active": False}, headers=other)).status_code == 404
    assert (await client.delete(url, headers=other)).status_code == 404
    assert (await client.get(RULES, headers=other)).json() == []


async def test_options(client: AsyncClient, headers: dict) -> None:
    body_ = (await client.get(f"{RULES}/options", headers=headers)).json()
    assert [s["slug"] for s in body_["stores"]] == ["carrefour", "jumbo"]
    assert body_["categories"] == ["almacen", "bebidas"]
    assert {m["key"] for m in body_["milestones"]} == {"cyberweek", "black_friday", "hot_sale"}
    assert all(m["ends_on"] >= TODAY.isoformat() for m in body_["milestones"])
    assert body_["max_rules"] == 50


# --- Evaluation -----------------------------------------------------------------------


async def preview(client: AsyncClient, headers: dict, **extra: object) -> dict:
    response = await client.post(f"{RULES}/preview", json=body(**extra), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_preview_uses_the_regular_price(client: AsyncClient, headers: dict) -> None:
    result = await preview(client, headers)
    assert Decimal(result["devaluation_pct"]) == 10
    assert result["products_count"] == 1
    assert result["stores_count"] == 1
    # Carrefour is on promo at 900 today: the regular 1200 counts (+20 %).
    assert result["items"] == [
        {
            "canonical_product_id": result["items"][0]["canonical_product_id"],
            "product_name": "Café molido 500 g",
            "store_name": "Carrefour",
            "variation_pct": "20.00",
        }
    ]


async def test_threshold_is_strict(client: AsyncClient, headers: dict) -> None:
    # Carrefour coffee is exactly 10 p.p. above the dollar.
    assert (await preview(client, headers, threshold_pp=10))["products_count"] == 0
    assert (await preview(client, headers, threshold_pp="9.99"))["products_count"] == 1


async def test_shrinkflation_compares_price_per_unit(client: AsyncClient, headers: dict) -> None:
    result = await preview(client, headers, threshold_pp=1)
    variations = {i["product_name"]: Decimal(i["variation_pct"]) for i in result["items"]}
    assert variations["Yerba mate 500 g"] == Decimal("11.11")


async def test_any_store_means_only_the_users_stores(
    client: AsyncClient, headers: dict, market: dict
) -> None:
    # Hidden doubles the coffee, but it is not the user's store.
    result = await preview(client, headers, threshold_pp=0)
    assert {i["store_name"] for i in result["items"]} == {"Carrefour", "Jumbo"}

    jumbo = await preview(
        client, headers, threshold_pp=0, store_id=str(market["stores"]["jumbo"].id)
    )
    assert [i["product_name"] for i in jumbo["items"]] == ["Yerba mate 500 g"]


async def test_official_rate(client: AsyncClient, headers: dict) -> None:
    result = await preview(client, headers, rate_type="official", threshold_pp=0)
    assert Decimal(result["devaluation_pct"]) == 0
    assert result["products_count"] == 3


async def test_milestone_outside_its_range_is_not_evaluated(
    client: AsyncClient, headers: dict
) -> None:
    result = await preview(
        client,
        headers,
        kind="milestone",
        milestone_key="custom",
        starts_on=(TODAY + timedelta(days=10)).isoformat(),
        ends_on=(TODAY + timedelta(days=12)).isoformat(),
    )
    assert result["evaluated"] is False
    assert result["products_count"] == 0


async def test_milestone_compares_with_the_price_before_it(
    client: AsyncClient, headers: dict
) -> None:
    result = await preview(
        client,
        headers,
        kind="milestone",
        milestone_key="custom",
        starts_on=(START + timedelta(days=1)).isoformat(),
        ends_on=(TODAY + timedelta(days=5)).isoformat(),
    )
    assert result["evaluated"] is True
    assert [i["product_name"] for i in result["items"]] == ["Café molido 500 g"]


# --- Worker and inbox -----------------------------------------------------------------


async def run_rules(day: date = TODAY) -> dict[str, int]:
    async with SessionLocal() as db:
        return await alerts.evaluate_all_rules(db, day)


async def test_worker_fires_once_and_the_preview_matches(
    client: AsyncClient, headers: dict
) -> None:
    rule = (await client.post(RULES, json=body(threshold_pp=1), headers=headers)).json()
    expected = await preview(client, headers, threshold_pp=1)

    assert await run_rules() == {"evaluated": 1, "fired": 1, "errors": 0}
    # Same day again: nothing new.
    assert await run_rules() == {"evaluated": 1, "fired": 0, "errors": 0}
    # Next day the same listings still match, but they fired less than 7 days ago.
    assert (await run_rules(TODAY + timedelta(days=1)))["fired"] == 0

    inbox = (await client.get(ALERTS, headers=headers)).json()
    assert inbox["total"] == 1
    alert = inbox["items"][0]
    assert alert["rule_id"] == rule["id"]
    assert alert["seen"] is False
    assert alert["products_count"] == expected["products_count"] == 2
    assert alert["scope_label"] == "Almacén · todas las tiendas · 30 días"
    assert alert["phrase"].startswith("Productos de Almacén en cualquier tienda subieron")

    detail = (await client.get(f"{ALERTS}/{alert['id']}", headers=headers)).json()
    assert [i["product_name"] for i in detail["items"]] == [
        i["product_name"] for i in expected["items"]
    ]
    assert detail["items"][0]["category"] == "almacen"
    assert Decimal(detail["items"][0]["price_end"]) == 1200

    rule = (await client.get(f"{RULES}/{rule['id']}", headers=headers)).json()
    assert rule["last_fired_at"] is not None


async def test_paused_rules_and_inactive_users_are_skipped(
    client: AsyncClient, headers: dict
) -> None:
    rule = (await client.post(RULES, json=body(), headers=headers)).json()
    await client.patch(f"{RULES}/{rule['id']}", json={"active": False}, headers=headers)
    assert (await run_rules())["evaluated"] == 0

    await client.patch(f"{RULES}/{rule['id']}", json={"active": True}, headers=headers)
    async with SessionLocal() as db:
        await db.execute(update(User).values(status=UserStatus.BLOCKED))
        await db.commit()
    assert (await run_rules())["evaluated"] == 0


async def test_rule_without_bell_does_not_ring(client: AsyncClient, headers: dict) -> None:
    await client.post(RULES, json=body(notify_in_app=False), headers=headers)
    await run_rules()
    summary = (await client.get(f"{ALERTS}/summary", headers=headers)).json()
    assert summary["total"] == 1
    assert summary["unseen"] == 0


async def test_summary_and_seen(client: AsyncClient, headers: dict) -> None:
    await client.post(RULES, json=body(), headers=headers)
    await client.post(RULES, json=body(name="Bebidas", category="bebidas"), headers=headers)
    await run_rules()

    summary = (await client.get(f"{ALERTS}/summary", headers=headers)).json()
    assert summary == {
        "unseen": 1,
        "total": 1,
        "active_rules": 2,
        "rules": 2,
        "affected_products": 1,
        "max_gap_pp": "10.00",
    }

    alert = (await client.get(ALERTS, params={"unseen": True}, headers=headers)).json()["items"][0]
    seen = await client.post(f"{ALERTS}/{alert['id']}/seen", headers=headers)
    assert seen.status_code == 204
    assert (await client.post(f"{ALERTS}/{alert['id']}/seen", headers=headers)).status_code == 204
    assert (await client.get(f"{ALERTS}/summary", headers=headers)).json()["unseen"] == 0
    assert (await client.get(ALERTS, params={"unseen": True}, headers=headers)).json()["total"] == 0


async def test_mark_all_seen(client: AsyncClient, headers: dict) -> None:
    await client.post(RULES, json=body(), headers=headers)
    await run_rules()
    assert (await client.post(f"{ALERTS}/seen", headers=headers)).status_code == 204
    assert (await client.get(f"{ALERTS}/summary", headers=headers)).json()["unseen"] == 0


async def test_alerts_of_another_user_are_404(client: AsyncClient, headers: dict) -> None:
    await client.post(RULES, json=body(), headers=headers)
    await run_rules()
    alert = (await client.get(ALERTS, headers=headers)).json()["items"][0]
    other = await other_user(client)
    assert (await client.get(f"{ALERTS}/{alert['id']}", headers=other)).status_code == 404
    assert (await client.post(f"{ALERTS}/{alert['id']}/seen", headers=other)).status_code == 404
    assert (await client.get(ALERTS, headers=other)).json()["total"] == 0


async def test_deleting_a_rule_deletes_its_alerts(client: AsyncClient, headers: dict) -> None:
    rule = (await client.post(RULES, json=body(), headers=headers)).json()
    await run_rules()
    await client.delete(f"{RULES}/{rule['id']}", headers=headers)
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(FiredAlert)) == 0


def test_daily_cron_is_registered() -> None:
    jobs = {job.name: job for job in tasks.WorkerSettings.cron_jobs}
    job = jobs["cron:evaluate_alert_rules"]
    assert (job.hour, job.minute) == (10, 30)
    assert job.unique is True
