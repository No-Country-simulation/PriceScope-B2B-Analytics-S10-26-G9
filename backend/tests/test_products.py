from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import (
    CanonicalProduct,
    Listing,
    Price,
    ProductCategory,
    Store,
    StoreCategory,
    UserStore,
)
from app.services.products import today_in_argentina
from tests.conftest import bearer, create_active_user, login

URL = "/api/v1/products"


async def add_store(db, slug: str) -> Store:
    store = Store(
        name=slug.title(),
        slug=slug,
        base_url=f"https://{slug}.example.com",
        category=StoreCategory.SUPERMARKET,
        scraper_key=slug,
    )
    db.add(store)
    await db.flush()
    return store


async def add_listing(db, store: Store, product: CanonicalProduct, code: str) -> Listing:
    listing = Listing(
        store_id=store.id,
        external_code=code,
        name=product.name,
        url=f"https://{store.slug}.example.com/{code}",
        canonical_product_id=product.id,
    )
    db.add(listing)
    await db.flush()
    return listing


def price(listing: Listing, at: datetime, ars: str, **extra: object) -> Price:
    values = {
        "listing_id": listing.id,
        "captured_at": at,
        "local_price": Decimal(ars),
        "regular_price": Decimal(extra.pop("regular", ars)),
        "price_usd_official": Decimal(ars) / 1000,
        "price_usd_blue": Decimal(ars) / 1250,
        "fx_official": Decimal("1000"),
        "fx_blue": Decimal("1250"),
        "quoted_at": at,
    }
    return Price(**(values | extra))


@pytest.fixture
async def coffee() -> dict:
    """Coffee in Carrefour (promo today) and Jumbo (500 → 450 g); yerba only in Carrefour."""
    now = datetime.now(UTC)
    async with SessionLocal() as db:
        carrefour = await add_store(db, "carrefour")
        jumbo = await add_store(db, "jumbo")
        hidden = await add_store(db, "hidden")
        coffee = CanonicalProduct(
            ean="07790000000401",
            name="Café molido 500 g",
            brand="Aroma Andino",
            content="500 g",
            category=ProductCategory.ALMACEN,
        )
        yerba = CanonicalProduct(
            ean="07790000000770", name="Yerba mate 1 kg", category=ProductCategory.ALMACEN
        )
        other = CanonicalProduct(ean="07790000003310", name="Leche 1 L")
        db.add_all([coffee, yerba, other])
        await db.flush()

        coffee_c = await add_listing(db, carrefour, coffee, "c1")
        coffee_j = await add_listing(db, jumbo, coffee, "j1")
        yerba_c = await add_listing(db, carrefour, yerba, "c2")
        other_h = await add_listing(db, hidden, other, "h1")
        db.add_all(
            [
                price(coffee_c, now - timedelta(days=10), "1000", grammage=Decimal(500), unit="g"),
                price(
                    coffee_c,
                    now,
                    "900",
                    regular="1100",
                    is_promo=True,
                    grammage=Decimal(500),
                    unit="g",
                ),
                price(coffee_j, now - timedelta(days=10), "1050", grammage=Decimal(500), unit="g"),
                price(coffee_j, now, "1080", grammage=Decimal(450), unit="g"),
                price(yerba_c, now, "5000"),
                price(other_h, now, "1400"),
            ]
        )
        await db.commit()
        return {
            "coffee": coffee,
            "yerba": yerba,
            "other": other,
            "stores": [carrefour, jumbo],
        }


async def client_with(client: AsyncClient, stores: list[Store]) -> dict[str, str]:
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        db.add_all([UserStore(user_id=user.id, store_id=s.id) for s in stores])
        await db.commit()
    return bearer(await login(client, "cliente@example.com"))


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401


async def test_detail_has_one_card_per_store(client: AsyncClient, coffee: dict) -> None:
    headers = await client_with(client, coffee["stores"])
    response = await client.get(f"{URL}/{coffee['coffee'].id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Café molido 500 g"
    assert body["brand"] == "Aroma Andino"
    assert body["category"] == "almacen"
    cards = {card["store_slug"]: card for card in body["stores"]}
    assert set(cards) == {"carrefour", "jumbo"}

    assert cards["carrefour"]["is_promo"] is True
    assert Decimal(cards["carrefour"]["local_price"]) == Decimal("900")
    assert Decimal(cards["carrefour"]["regular_price"]) == Decimal("1100")
    assert Decimal(cards["carrefour"]["price_per_unit"]) == Decimal("1.8")
    assert cards["carrefour"]["unit"] == "g"
    assert cards["carrefour"]["shrinkflation"] is None

    assert cards["jumbo"]["content"] == "450 g"
    assert Decimal(cards["jumbo"]["price_per_unit"]) == Decimal("2.4")
    assert cards["jumbo"]["shrinkflation"]["before"] == "500 g"
    assert cards["jumbo"]["shrinkflation"]["after"] == "450 g"


async def test_detail_only_shows_visible_stores(client: AsyncClient, coffee: dict) -> None:
    headers = await client_with(client, [coffee["stores"][1]])
    body = (await client.get(f"{URL}/{coffee['coffee'].id}", headers=headers)).json()
    assert [card["store_slug"] for card in body["stores"]] == ["jumbo"]


@pytest.mark.parametrize("product", ["yerba", "other"])
async def test_detail_404_outside_the_users_stores(
    client: AsyncClient, coffee: dict, product: str
) -> None:
    headers = await client_with(client, [coffee["stores"][1]])  # only Jumbo
    response = await client.get(f"{URL}/{coffee[product].id}", headers=headers)
    assert response.status_code == 404


async def test_detail_404_for_unknown_product(client: AsyncClient, admin_token: str) -> None:
    response = await client.get(
        f"{URL}/00000000-0000-0000-0000-000000000000", headers=bearer(admin_token)
    )
    assert response.status_code == 404


async def test_history_has_one_point_per_store_and_day(client: AsyncClient, coffee: dict) -> None:
    headers = await client_with(client, coffee["stores"])
    response = await client.get(
        f"{URL}/{coffee['coffee'].id}/history",
        params={"days": 30, "rate": "official"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rate"] == "official"
    assert body["end"] == today_in_argentina().isoformat()
    assert body["stores"] == [
        {"slug": "carrefour", "name": "Carrefour"},
        {"slug": "jumbo", "name": "Jumbo"},
    ]
    points = body["points"]
    assert len(points) == 4
    assert [p["store_slug"] for p in points[:2]] == ["carrefour", "jumbo"]
    today = [p for p in points if p["date"] == body["end"]]
    carrefour = next(p for p in today if p["store_slug"] == "carrefour")
    assert carrefour["is_promo"] is True
    assert Decimal(carrefour["usd_price"]) == Decimal("0.9")
    assert Decimal(carrefour["fx"]) == Decimal("1000")
    jumbo = next(p for p in today if p["store_slug"] == "jumbo")
    assert jumbo["content"] == "450 g"


async def test_history_period_excludes_older_prices(client: AsyncClient, coffee: dict) -> None:
    async with SessionLocal() as db:
        listing = await db.scalar(select(Listing).where(Listing.external_code == "c1"))
        db.add(price(listing, datetime.now(UTC) - timedelta(days=200), "500"))
        await db.commit()
    headers = await client_with(client, coffee["stores"])

    short = await client.get(f"{URL}/{coffee['coffee'].id}/history?days=90", headers=headers)
    long = await client.get(f"{URL}/{coffee['coffee'].id}/history?days=365", headers=headers)

    assert len(short.json()["points"]) == 4
    assert len(long.json()["points"]) == 5


async def test_history_rejects_other_periods(client: AsyncClient, coffee: dict) -> None:
    headers = await client_with(client, coffee["stores"])
    response = await client.get(f"{URL}/{coffee['coffee'].id}/history?days=45", headers=headers)
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({}, ["Café molido 500 g", "Yerba mate 1 kg"]),
        ({"q": "CAFE"}, ["Café molido 500 g"]),
        ({"q": "andino"}, ["Café molido 500 g"]),
        ({"q": "0779000000077"}, ["Yerba mate 1 kg"]),
        ({"q": "%%"}, []),
        ({"category": "almacen", "limit": 1}, ["Café molido 500 g"]),
        ({"category": "lacteos"}, []),
    ],
)
async def test_search(client: AsyncClient, coffee: dict, params: dict, expected: list) -> None:
    headers = await client_with(client, coffee["stores"])
    response = await client.get(URL, params=params, headers=headers)
    assert [p["name"] for p in response.json()] == expected


async def test_search_can_exclude_a_product(client: AsyncClient, coffee: dict) -> None:
    headers = await client_with(client, coffee["stores"])
    response = await client.get(URL, params={"exclude": str(coffee["coffee"].id)}, headers=headers)
    assert [p["name"] for p in response.json()] == ["Yerba mate 1 kg"]
