from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.core.database import SessionLocal
from app.models import CanonicalProduct, Listing, Price, Store, StoreCategory, UserStore
from tests.conftest import bearer, create_active_user, login

URL = "/api/v1/matrix"
NOW = datetime(2026, 11, 4, 12, 0, tzinfo=UTC)


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


async def add_listing(
    db,
    store: Store,
    product: CanonicalProduct,
    code: str,
    ars: str,
    usd_official: str,
    usd_blue: str,
    available: bool = True,
    regular: str | None = None,
    promo: bool = False,
) -> Listing:
    listing = Listing(
        store_id=store.id,
        external_code=code,
        name=product.name,
        url=f"https://{store.slug}.example.com/{code}",
        canonical_product_id=product.id,
    )
    db.add(listing)
    await db.flush()
    db.add(
        Price(
            listing_id=listing.id,
            captured_at=NOW,
            local_price=Decimal(ars),
            price_usd_official=Decimal(usd_official),
            price_usd_blue=Decimal(usd_blue),
            available=available,
            regular_price=Decimal(regular or ars),
            is_promo=promo,
        )
    )
    return listing


@pytest.fixture
async def catalog() -> dict[str, Store]:
    """Rice in both stores, Cindor only in Carrefour."""
    async with SessionLocal() as db:
        carrefour = await add_store(db, "carrefour")
        jumbo = await add_store(db, "jumbo")
        rice = CanonicalProduct(ean="07790070000012", name="Arroz Gallo Oro 1 kg")
        cindor = CanonicalProduct(ean="07791337007253", name="Leche Cindor 1 lt")
        db.add_all([rice, cindor])
        await db.flush()

        rice_carrefour = await add_listing(db, carrefour, rice, "1", "3245.00", "2.30", "2.07")
        await add_listing(db, jumbo, rice, "2", "3400.00", "2.41", "2.17")
        await add_listing(db, carrefour, cindor, "3", "8210.00", "5.82", "5.25")

        # Older capture: the matrix must ignore it.
        db.add(
            Price(
                listing_id=rice_carrefour.id,
                captured_at=NOW - timedelta(days=1),
                local_price=Decimal("2000.00"),
                price_usd_official=Decimal("1.50"),
                price_usd_blue=Decimal("1.40"),
            )
        )
        await db.commit()
        return {"carrefour": carrefour, "jumbo": jumbo}


async def client_headers(client: AsyncClient, stores: list[Store]) -> dict[str, str]:
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        db.add_all([UserStore(user_id=user.id, store_id=s.id) for s in stores])
        await db.commit()
    return bearer(await login(client, "cliente@example.com"))


def row(body: dict, ean: str) -> dict:
    return next(item for item in body["items"] if item["ean"] == ean)


def prices(item: dict) -> dict[str, str | None]:
    return {cell["store_slug"]: cell["price"] for cell in item["prices"]}


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401


async def test_invalid_currency(client: AsyncClient, admin_token: str) -> None:
    response = await client.get(URL, params={"currency": "eur"}, headers=bearer(admin_token))
    assert response.status_code == 422


async def test_admin_sees_all_stores_and_latest_price(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    response = await client.get(URL, headers=bearer(admin_token))
    assert response.status_code == 200
    body = response.json()

    assert body["total"] == 2
    assert [s["slug"] for s in body["stores"]] == ["carrefour", "jumbo"]
    assert body["currency"] == "ars"
    assert body["rate"] is None
    assert prices(row(body, "07790070000012")) == {"carrefour": "3245.00", "jumbo": "3400.00"}


@pytest.mark.parametrize(
    ("rate", "expected"),
    [
        ("official", {"carrefour": "2.30", "jumbo": "2.41"}),
        ("blue", {"carrefour": "2.07", "jumbo": "2.17"}),
    ],
)
async def test_usd_uses_selected_rate(
    client: AsyncClient,
    admin_token: str,
    catalog: dict[str, Store],
    rate: str,
    expected: dict[str, str],
) -> None:
    response = await client.get(
        URL, params={"currency": "usd", "rate": rate}, headers=bearer(admin_token)
    )
    body = response.json()
    assert body["rate"] == rate
    assert prices(row(body, "07790070000012")) == expected


async def test_min_stores_keeps_only_comparable_products(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    response = await client.get(URL, params={"min_stores": 2}, headers=bearer(admin_token))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ean"] == "07790070000012"


async def test_search_is_case_insensitive_and_escapes_wildcards(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    found = await client.get(URL, params={"q": "CINDOR"}, headers=bearer(admin_token))
    assert [i["ean"] for i in found.json()["items"]] == ["07791337007253"]

    wildcard = await client.get(URL, params={"q": "%%"}, headers=bearer(admin_token))
    assert wildcard.json()["total"] == 0


async def test_pagination(client: AsyncClient, admin_token: str, catalog: dict[str, Store]) -> None:
    response = await client.get(URL, params={"page": 2, "size": 1}, headers=bearer(admin_token))
    body = response.json()
    assert body["total"] == 2
    assert [i["ean"] for i in body["items"]] == ["07791337007253"]


async def test_client_only_sees_assigned_stores(
    client: AsyncClient, catalog: dict[str, Store]
) -> None:
    headers = await client_headers(client, [catalog["carrefour"]])
    body = (await client.get(URL, headers=headers)).json()

    assert [s["slug"] for s in body["stores"]] == ["carrefour"]
    assert body["total"] == 2
    assert prices(row(body, "07790070000012")) == {"carrefour": "3245.00"}


async def test_client_without_stores_gets_empty_matrix(
    client: AsyncClient, catalog: dict[str, Store]
) -> None:
    headers = await client_headers(client, [])
    body = (await client.get(URL, headers=headers)).json()
    assert body["items"] == []
    assert body["stores"] == []
    assert body["total"] == 0


async def test_spread_between_stores(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    body = (await client.get(URL, headers=bearer(admin_token))).json()

    spread = row(body, "07790070000012")["spread"]
    assert spread["cheapest_store_slug"] == "carrefour"
    assert spread["most_expensive_store_slug"] == "jumbo"
    assert spread["difference"] == "155.00"
    assert spread["percentage"] == "4.78"


async def test_spread_is_null_with_a_single_store(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    body = (await client.get(URL, headers=bearer(admin_token))).json()
    assert row(body, "07791337007253")["spread"] is None


async def test_spread_tie_has_no_cheapest_store(client: AsyncClient, admin_token: str) -> None:
    async with SessionLocal() as db:
        alpha = await add_store(db, "alpha")
        beta = await add_store(db, "beta")
        product = CanonicalProduct(ean="07790000000001", name="Producto empatado")
        db.add(product)
        await db.flush()
        await add_listing(db, alpha, product, "1", "100.00", "0.10", "0.09")
        await add_listing(db, beta, product, "2", "100.00", "0.10", "0.09")
        await db.commit()

    body = (await client.get(URL, headers=bearer(admin_token))).json()
    spread = row(body, "07790000000001")["spread"]
    assert spread["cheapest_store_slug"] is None
    assert spread["most_expensive_store_slug"] is None
    assert spread["percentage"] == "0.00"


async def test_spread_ignores_unavailable_offers(client: AsyncClient, admin_token: str) -> None:
    async with SessionLocal() as db:
        alpha = await add_store(db, "alpha")
        beta = await add_store(db, "beta")
        product = CanonicalProduct(ean="07790000000002", name="Producto sin stock")
        db.add(product)
        await db.flush()
        await add_listing(db, alpha, product, "1", "100.00", "0.10", "0.09")
        await add_listing(db, beta, product, "2", "300.00", "0.30", "0.27", available=False)
        await db.commit()

    body = (await client.get(URL, headers=bearer(admin_token))).json()
    assert row(body, "07790000000002")["spread"] is None


async def test_promotion_shows_regular_and_promo_prices(
    client: AsyncClient, admin_token: str
) -> None:
    async with SessionLocal() as db:
        store = await add_store(db, "alpha")
        product = CanonicalProduct(ean="07790000000003", name="Producto en promo")
        db.add(product)
        await db.flush()
        await add_listing(
            db, store, product, "1", "3000.00", "3.00", "2.00", regular="4000.00", promo=True
        )
        await db.commit()

    body = (await client.get(URL, headers=bearer(admin_token))).json()
    item = row(body, "07790000000003")
    cell = item["prices"][0]

    assert cell["is_promo"] is True
    assert cell["price"] == "3000.00"
    assert cell["regular_price"] == "4000.00"
    assert item["has_promotion"] is True
    assert item["shrinkflation"] is False


@pytest.mark.parametrize(("rate", "expected"), [("official", "4.00"), ("blue", "2.67")])
async def test_regular_price_in_usd_scales_with_selected_rate(
    client: AsyncClient, admin_token: str, rate: str, expected: str
) -> None:
    async with SessionLocal() as db:
        store = await add_store(db, "alpha")
        product = CanonicalProduct(ean="07790000000004", name="Producto en promo usd")
        db.add(product)
        await db.flush()
        await add_listing(
            db, store, product, "1", "3000.00", "3.00", "2.00", regular="4000.00", promo=True
        )
        await db.commit()

    response = await client.get(
        URL, params={"currency": "usd", "rate": rate}, headers=bearer(admin_token)
    )
    cell = row(response.json(), "07790000000004")["prices"][0]
    assert cell["regular_price"] == expected


async def test_product_without_promotion(
    client: AsyncClient, admin_token: str, catalog: dict[str, Store]
) -> None:
    body = (await client.get(URL, headers=bearer(admin_token))).json()
    item = row(body, "07790070000012")

    assert item["has_promotion"] is False
    assert all(c["is_promo"] is False and c["regular_price"] == c["price"] for c in item["prices"])
