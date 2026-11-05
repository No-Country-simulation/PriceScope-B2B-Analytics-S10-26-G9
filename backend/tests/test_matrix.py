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
