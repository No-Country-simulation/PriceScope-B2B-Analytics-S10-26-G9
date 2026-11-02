import httpx
import pytest

from app.core.database import SessionLocal
from app.models import Store, StoreCategory, StoreLocation
from tests.conftest import bearer

BASE_URL = "/api/v1/admin/stores"


@pytest.fixture
async def store() -> Store:
    async with SessionLocal() as db:
        item = Store(
            name="Supermercado de prueba",
            slug="supermercado-prueba",
            base_url="https://tienda.example.com",
            category=StoreCategory.SUPERMARKET,
            scraper_key="supermercado-prueba",
            active=True,
        )

        db.add(item)
        await db.commit()

        return item


def location_data(
    code: str = "centro-retiro",
) -> dict:
    return {
        "code": code,
        "name": "Sucursal Centro",
        "city": "Ciudad de prueba",
        "province": "Provincia de prueba",
        "postal_code": "3500",
        "fulfillment_mode": "pickup",
    }


async def test_locations_get_requires_admin(
    client: httpx.AsyncClient,
    store: Store,
    client_token: str,
) -> None:
    url = f"{BASE_URL}/{store.slug}/locations"

    assert (await client.get(url)).status_code == 401

    response = await client.get(
        url,
        headers=bearer(client_token),
    )

    assert response.status_code == 403


async def test_locations_post_requires_admin(
    client: httpx.AsyncClient,
    store: Store,
    client_token: str,
) -> None:
    url = f"{BASE_URL}/{store.slug}/locations"

    response = await client.post(
        url,
        json=location_data(),
    )
    assert response.status_code == 401

    response = await client.post(
        url,
        json=location_data(),
        headers=bearer(client_token),
    )
    assert response.status_code == 403


async def test_create_and_list_locations(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    url = f"{BASE_URL}/{store.slug}/locations"
    headers = bearer(admin_token)

    created = await client.post(
        url,
        json=location_data(),
        headers=headers,
    )

    assert created.status_code == 201, created.text

    data = created.json()

    assert data["id"]
    assert data["store_id"] == str(store.id)
    assert data["code"] == "centro-retiro"
    assert data["name"] == "Sucursal Centro"
    assert data["fulfillment_mode"] == "pickup"
    assert data["active"] is True
    assert data["region_id"] is None

    listed = await client.get(
        url,
        headers=headers,
    )

    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == data["id"]


async def test_rejects_duplicate_location_code(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    url = f"{BASE_URL}/{store.slug}/locations"
    headers = bearer(admin_token)

    first = await client.post(
        url,
        json=location_data(),
        headers=headers,
    )

    second = await client.post(
        url,
        json=location_data(),
        headers=headers,
    )

    assert first.status_code == 201
    assert second.status_code == 409


async def test_rejects_invalid_fulfillment_mode(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    url = f"{BASE_URL}/{store.slug}/locations"

    invalid = location_data()
    invalid["fulfillment_mode"] = "unknown"

    response = await client.post(
        url,
        json=invalid,
        headers=bearer(admin_token),
    )

    assert response.status_code == 422


async def test_unknown_store_returns_404(
    client: httpx.AsyncClient,
    admin_token: str,
) -> None:
    url = f"{BASE_URL}/inexistente/locations"
    headers = bearer(admin_token)

    listed = await client.get(url, headers=headers)
    created = await client.post(
        url,
        json=location_data(),
        headers=headers,
    )

    assert listed.status_code == 404
    assert created.status_code == 404


async def test_inactive_store_returns_404(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        item = await db.get(Store, store.id)
        assert item is not None

        item.active = False
        await db.commit()

    response = await client.get(
        f"{BASE_URL}/{store.slug}/locations",
        headers=bearer(admin_token),
    )

    assert response.status_code == 404


async def test_locations_are_scoped_to_store(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        other = Store(
            name="Otro supermercado",
            slug="otro-supermercado",
            base_url="https://otro.example.com",
            category=StoreCategory.SUPERMARKET,
            scraper_key="otro-supermercado",
            active=True,
        )
        db.add(other)
        await db.commit()

    headers = bearer(admin_token)
    first_url = f"{BASE_URL}/{store.slug}/locations"
    second_url = f"{BASE_URL}/{other.slug}/locations"

    created = await client.post(
        second_url,
        json=location_data(),
        headers=headers,
    )

    assert created.status_code == 201

    first_list = await client.get(
        first_url,
        headers=headers,
    )

    second_list = await client.get(
        second_url,
        headers=headers,
    )

    assert first_list.status_code == 200
    assert first_list.json() == []

    assert second_list.status_code == 200
    assert len(second_list.json()) == 1


async def test_configure_delivery_regional_context(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        location = StoreLocation(
            store_id=store.id,
            code="zona-test",
            name="Zona de prueba",
            fulfillment_mode="delivery",
        )
        db.add(location)
        await db.commit()
        location_id = location.id

    response = await client.patch(
        f"{BASE_URL}/{store.slug}/locations/{location_id}/regional-context",
        json={
            "sales_channel": "1",
            "region_id": "region-test",
        },
        headers=bearer(admin_token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["sales_channel"] == "1"
    assert response.json()["region_id"] == "region-test"

    async with SessionLocal() as db:
        saved = await db.get(StoreLocation, location_id)

    assert saved is not None
    assert saved.region_id == "region-test"


async def test_rejects_pickup_regional_context(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        location = StoreLocation(
            store_id=store.id,
            code="retiro-test",
            name="Punto de retiro",
            fulfillment_mode="pickup",
        )
        db.add(location)
        await db.commit()
        location_id = location.id

    response = await client.patch(
        f"{BASE_URL}/{store.slug}/locations/{location_id}/regional-context",
        json={
            "sales_channel": "1",
            "region_id": "region-test",
        },
        headers=bearer(admin_token),
    )

    assert response.status_code == 409


async def test_rejects_invalid_sales_channel(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    response = await client.patch(
        f"{BASE_URL}/{store.slug}/locations/00000000-0000-0000-0000-000000000001/regional-context",
        json={
            "sales_channel": "0",
            "region_id": "region-test",
        },
        headers=bearer(admin_token),
    )

    assert response.status_code == 422
