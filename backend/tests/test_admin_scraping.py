from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import func, select

from app.api.v1.admin_scraping import get_scraping_http
from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import Listing, Price, Store, StoreCategory, StoreLocation
from app.services import scraping_rate_limit
from app.services.scraping_lock import scrape_store_lock
from app.services.scraping_rate_limit import throttle_scraping_request
from tests.conftest import bearer

URL = "/api/v1/admin/scraping/run"
REQUEST = {
    "store_slug": "carrefour",
    "term": "leche",
    "page_size": 10,
    "max_pages": 1,
}


@pytest.fixture
async def store() -> Store:
    async with SessionLocal() as db:
        item = Store(
            name="Carrefour de prueba",
            slug="carrefour",
            base_url="https://www.carrefour.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="carrefour",
            active=True,
        )
        db.add(item)
        await db.commit()
        return item


@pytest.fixture
def enable_scraping(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Enable one test store using mocked HTTP only."""

    monkeypatch.setattr(
        settings,
        "scraping_enabled",
        True,
    )

    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        ["carrefour"],
    )

    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {"carrefour": ["1"]},
    )


def product() -> dict:
    return {
        "productName": "Leche Entera 1 L",
        "link": "/leche-entera/p",
        "categories": ["/Lacteos/"],
        "items": [
            {
                "itemId": "SKU-123",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "commertialOffer": {
                            "Price": 1500,
                            "ListPrice": 1800,
                            "AvailableQuantity": 5,
                        },
                    }
                ],
            }
        ],
    }


async def test_endpoint_requires_admin(
    client: httpx.AsyncClient,
    store: Store,
    client_token: str,
) -> None:
    assert (await client.post(URL, json=REQUEST)).status_code == 401

    response = await client.post(
        URL,
        json=REQUEST,
        headers=bearer(client_token),
    )
    assert response.status_code == 403


async def test_scraping_disabled_by_default(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "scraping_enabled", False)

    response = await client.post(
        URL,
        json=REQUEST,
        headers=bearer(admin_token),
    )
    assert response.status_code == 503


async def test_unknown_store(
    client: httpx.AsyncClient,
    admin_token: str,
    enable_scraping: None,
) -> None:
    response = await client.post(
        URL,
        json=REQUEST,
        headers=bearer(admin_token),
    )
    assert response.status_code == 404


async def test_missing_seller_configuration(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "scraping_seller_ids", {})

    response = await client.post(
        URL,
        json=REQUEST,
        headers=bearer(admin_token),
    )
    assert response.status_code == 503


async def test_invalid_payload(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
) -> None:
    response = await client.post(
        URL,
        json={**REQUEST, "page_size": 100},
        headers=bearer(admin_token),
    )
    assert response.status_code == 422


async def test_success_saves_prices(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.carrefour.com.ar"
        assert request.url.params["ft"] == "leche"
        return httpx.Response(200, json=[product()])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.post(
                URL,
                json=REQUEST,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["store"] == "carrefour"
    assert data["products_received"] == 1
    assert data["observations_saved"] == 1
    assert data["skipped_duplicates"] == 0

    async with SessionLocal() as db:
        listing_count = await db.scalar(select(func.count()).select_from(Listing))
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert listing_count == 1
    assert price_count == 1


async def test_upstream_error_returns_502(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(503))
    ) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.post(
                URL,
                json=REQUEST,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 502

    async with SessionLocal() as db:
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_category_mode_saves_prices(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["fq"] == "C:123"
        assert "ft" not in request.url.params
        return httpx.Response(200, json=[product()])

    payload = {
        "store_slug": "carrefour",
        "category_id": 123,
        "page_size": 10,
        "max_pages": 1,
    }

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.post(
                URL,
                json=payload,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text
    assert response.json()["observations_saved"] == 1

    async with SessionLocal() as db:
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 1


async def test_both_search_modes_returns_422(
    client: httpx.AsyncClient,
    admin_token: str,
) -> None:
    response = await client.post(
        URL,
        json={
            "store_slug": "carrefour",
            "term": "leche",
            "category_id": 123,
        },
        headers=bearer(admin_token),
    )

    assert response.status_code == 422


async def test_missing_search_mode_returns_422(
    client: httpx.AsyncClient,
    admin_token: str,
) -> None:
    response = await client.post(
        URL,
        json={"store_slug": "carrefour"},
        headers=bearer(admin_token),
    )

    assert response.status_code == 422


def category_tree() -> list[dict]:
    return [
        {
            "id": 10,
            "name": "Almacen",
            "hasChildren": True,
            "children": [
                {
                    "id": 25,
                    "name": "Lacteos",
                    "hasChildren": True,
                    "children": [
                        {
                            "id": 123,
                            "name": "Leches",
                            "hasChildren": False,
                            "children": [],
                        }
                    ],
                }
            ],
        }
    ]


async def test_categories_require_admin(
    client: httpx.AsyncClient,
    store: Store,
    client_token: str,
) -> None:
    url = "/api/v1/admin/scraping/stores/carrefour/categories"

    assert (await client.get(url)).status_code == 401

    response = await client.get(
        url,
        headers=bearer(client_token),
    )
    assert response.status_code == 403


async def test_categories_disabled(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "scraping_enabled", False)

    url = "/api/v1/admin/scraping/stores/carrefour/categories"
    response = await client.get(
        url,
        headers=bearer(admin_token),
    )

    assert response.status_code == 503


async def test_categories_pagination(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/category/tree/3")
        return httpx.Response(200, json=category_tree())

    url = "/api/v1/admin/scraping/stores/carrefour/categories?offset=1&limit=1"

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.get(
                url,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["store"] == "carrefour"
    assert data["total"] == 3
    assert data["limit"] == 1
    assert data["offset"] == 1
    assert data["has_more"] is True

    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == 25
    assert data["items"][0]["path"] == "Almacen > Lacteos"


async def test_categories_then_scrape_product(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    """Discover an ID, then use it to save a product."""

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/category/tree/3"):
            return httpx.Response(200, json=category_tree())

        if request.url.path.endswith("/products/search"):
            assert request.url.params["fq"] == "C:123"
            return httpx.Response(200, json=[product()])

        pytest.fail(f"Unexpected HTTP request: {request.url}")

    headers = bearer(admin_token)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            categories_response = await client.get(
                "/api/v1/admin/scraping/stores/carrefour/categories",
                headers=headers,
            )

            assert categories_response.status_code == 200

            categories = categories_response.json()["items"]
            category_id = categories[-1]["id"]

            scrape_response = await client.post(
                URL,
                json={
                    "store_slug": "carrefour",
                    "category_id": category_id,
                    "page_size": 10,
                    "max_pages": 1,
                },
                headers=headers,
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert category_id == 123
    assert scrape_response.status_code == 200
    assert scrape_response.json()["observations_saved"] == 1

    async with SessionLocal() as db:
        listing_count = await db.scalar(select(func.count()).select_from(Listing))
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert listing_count == 1
    assert price_count == 1


async def test_categories_upstream_error(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(503))
    ) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.get(
                "/api/v1/admin/scraping/stores/carrefour/categories",
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 502


async def test_multiple_categories_endpoint(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["fq"] in {
            "C:123",
            "C:124",
        }

        return httpx.Response(200, json=[product()])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            response = await client.post(
                URL,
                json={
                    "store_slug": "carrefour",
                    "category_ids": [123, 124],
                    "page_size": 10,
                    "max_pages": 1,
                },
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text

    result = response.json()

    assert result["products_received"] == 2
    assert result["observations_saved"] == 1
    assert result["skipped_duplicates"] == 1


async def test_seller_preview_without_saving_prices(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    sample = product()

    sample["items"][0]["sellers"][0]["sellerName"] = "Tienda principal"

    sample["items"][0]["sellers"].append(
        {
            "sellerId": "99",
            "sellerName": "Marketplace externo",
            "sellerDefault": False,
            "commertialOffer": {
                "Price": 1300,
            },
        }
    )

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["ft"] == "leche"
        return httpx.Response(200, json=[sample])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            response = await client.get(
                "/api/v1/admin/scraping/stores/carrefour/sellers/preview",
                params={
                    "term": "leche",
                    "page_size": 10,
                    "max_pages": 1,
                },
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["store"] == "carrefour"
    assert data["products_received"] == 1

    seller_ids = {seller["seller_id"] for seller in data["sellers"]}

    assert seller_ids == {"1", "99"}

    async with SessionLocal() as db:
        listing_count = await db.scalar(select(func.count()).select_from(Listing))
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert listing_count == 0
    assert price_count == 0


async def test_scraping_returns_409_when_store_is_busy(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    """A second run is rejected while the store is locked."""

    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[product()])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            # Simulate an extraction already in progress.
            async with scrape_store_lock(store.id):
                blocked_response = await client.post(
                    URL,
                    json=REQUEST,
                    headers=bearer(admin_token),
                )

            # Once released, the same request can execute.
            allowed_response = await client.post(
                URL,
                json=REQUEST,
                headers=bearer(admin_token),
            )

        finally:
            app.dependency_overrides.pop(
                get_scraping_http,
                None,
            )

    assert blocked_response.status_code == 409
    assert "extracción en curso" in (blocked_response.json()["detail"])

    assert allowed_response.status_code == 200
    assert allowed_response.json()["observations_saved"] == 1


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/v1/admin/scraping/run"),
        (
            "GET",
            "/api/v1/admin/scraping/stores/carrefour/categories",
        ),
        (
            "GET",
            "/api/v1/admin/scraping/stores/carrefour/sellers/preview",
        ),
    ],
)
async def test_store_must_be_explicitly_allowed(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
) -> None:
    monkeypatch.setattr(
        settings,
        "scraping_allowed_stores",
        [],
    )

    response = await client.request(
        method,
        path,
        json=REQUEST if method == "POST" else None,
        headers=bearer(admin_token),
    )

    assert response.status_code == 403
    assert "no está habilitada" in response.json()["detail"]


async def test_rejects_store_with_unexpected_origin(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    async with SessionLocal() as db:
        db_store = await db.get(Store, store.id)

        assert db_store is not None

        db_store.base_url = "https://www.carrefour.com.ar.ejemplo.test"
        await db.commit()

    response = await client.post(
        URL,
        json=REQUEST,
        headers=bearer(admin_token),
    )

    assert response.status_code == 403
    assert "no está aprobada" in response.json()["detail"]


READINESS_URL = "/api/v1/admin/scraping/stores/readiness"


async def test_readiness_requires_admin(
    client: httpx.AsyncClient,
    store: Store,
    client_token: str,
) -> None:
    response = await client.get(READINESS_URL)
    assert response.status_code == 401

    response = await client.get(
        READINESS_URL,
        headers=bearer(client_token),
    )
    assert response.status_code == 403


async def test_readiness_reports_disabled_configuration(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "scraping_enabled", False)
    monkeypatch.setattr(settings, "scraping_allowed_stores", [])
    monkeypatch.setattr(settings, "scraping_seller_ids", {})

    response = await client.get(
        READINESS_URL,
        headers=bearer(admin_token),
    )

    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1

    result = data[0]

    assert result["store_slug"] == "carrefour"
    assert result["store_active"] is True
    assert result["globally_enabled"] is False
    assert result["technically_ready"] is False
    assert result["configured_seller_count"] == 0
    assert result["issues"]


async def test_readiness_reports_complete_technical_setup(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    response = await client.get(
        READINESS_URL,
        headers=bearer(admin_token),
    )

    assert response.status_code == 200

    result = response.json()[0]

    assert result["technically_ready"] is True
    assert result["configured_seller_count"] == 1
    assert result["issues"] == []


async def test_readiness_rejects_blank_seller_ids(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "scraping_seller_ids",
        {"carrefour": ["", "  "]},
    )

    response = await client.get(
        READINESS_URL,
        headers=bearer(admin_token),
    )

    assert response.status_code == 200

    result = response.json()[0]

    assert result["configured_seller_count"] == 0
    assert result["technically_ready"] is False
    assert "Faltan identificadores de vendedores" in (result["issues"])


async def test_scraping_fails_closed_when_redis_is_down(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests_sent = []

    broken_redis = SimpleNamespace(
        set=AsyncMock(side_effect=RedisConnectionError("offline")),
        pttl=AsyncMock(),
    )

    monkeypatch.setattr(
        scraping_rate_limit,
        "redis_client",
        broken_redis,
    )

    def respond(request: httpx.Request) -> httpx.Response:
        requests_sent.append(request)
        return httpx.Response(200, json=[product()])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond),
        event_hooks={
            "request": [throttle_scraping_request],
        },
    ) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            response = await client.post(
                URL,
                json=REQUEST,
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(
                get_scraping_http,
                None,
            )

    assert response.status_code == 503
    assert "Redis no está disponible" in (response.json()["detail"])

    # No external request should be attempted.
    assert requests_sent == []

    async with SessionLocal() as db:
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_regional_preview_uses_location_context(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    async with SessionLocal() as db:
        location = StoreLocation(
            store_id=store.id,
            code="zona-regional",
            name="Zona regional de prueba",
            fulfillment_mode="delivery",
            sales_channel="1",
            region_id="region-test",
        )
        db.add(location)
        await db.commit()
        location_id = location.id

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["sc"] == "1"
        assert request.url.params["regionId"] == "region-test"
        assert request.url.params["query"] == "leche"
        assert request.url.params["count"] == "5"
        assert request.url.params["page"] == "1"

        return httpx.Response(
            200,
            json={
                "products": [
                    {
                        "productId": "101",
                        "productName": "Leche de prueba",
                        "items": [
                            {
                                "itemId": "SKU-101",
                                "sellers": [
                                    {
                                        "sellerId": "99",
                                        "sellerName": "Vendedor de prueba",
                                        "commertialOffer": {
                                            "Price": 1500,
                                        },
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        )

    url = f"/api/v1/admin/scraping/stores/carrefour/locations/{location_id}/regional-preview"

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http
        try:
            response = await client.get(
                url,
                params={"term": "leche"},
                headers=bearer(admin_token),
            )
        finally:
            app.dependency_overrides.pop(get_scraping_http, None)

    assert response.status_code == 200, response.text

    result = response.json()

    assert result["store"] == "carrefour"
    assert result["location_id"] == str(location_id)
    assert result["location_code"] == "zona-regional"
    assert result["products_received"] == 1
    assert result["products"][0]["name"] == "Leche de prueba"
    assert result["sellers"][0]["seller_id"] == "99"

    # A preview must never persist prices.
    async with SessionLocal() as db:
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert price_count == 0


async def test_regional_preview_rejects_incomplete_context(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    async with SessionLocal() as db:
        location = StoreLocation(
            store_id=store.id,
            code="zona-sin-configurar",
            name="Zona no configurada",
            fulfillment_mode="delivery",
        )
        db.add(location)
        await db.commit()
        location_id = location.id

    response = await client.get(
        f"/api/v1/admin/scraping/stores/carrefour/locations/{location_id}/regional-preview",
        headers=bearer(admin_token),
    )

    assert response.status_code == 409


async def test_regional_preview_distinguishes_prices(
    client: httpx.AsyncClient,
    store: Store,
    admin_token: str,
    enable_scraping: None,
) -> None:
    """Same SKU, different regional prices, no persistence."""

    async with SessionLocal() as db:
        first = StoreLocation(
            store_id=store.id,
            code="zona-a",
            name="Zona A",
            fulfillment_mode="delivery",
            sales_channel="1",
            region_id="region-a",
        )

        second = StoreLocation(
            store_id=store.id,
            code="zona-b",
            name="Zona B",
            fulfillment_mode="delivery",
            sales_channel="1",
            region_id="region-b",
        )

        db.add_all([first, second])
        await db.commit()

        location_ids = [first.id, second.id]

    def respond(request: httpx.Request) -> httpx.Response:
        region = request.url.params["regionId"]

        prices = {
            "region-a": 1500,
            "region-b": 1800,
        }

        assert region in prices

        return httpx.Response(
            200,
            json={
                "products": [
                    {
                        "productId": "101",
                        "productName": "Leche de prueba",
                        "items": [
                            {
                                "itemId": "SKU-101",
                                "sellers": [
                                    {
                                        "sellerId": "1",
                                        "sellerName": "Vendedor prueba",
                                        "commertialOffer": {
                                            "Price": prices[region],
                                        },
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        )

    responses = []

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as fake_http:
        app.dependency_overrides[get_scraping_http] = lambda: fake_http

        try:
            for location_id in location_ids:
                response = await client.get(
                    "/api/v1/admin/scraping/stores/"
                    f"carrefour/locations/{location_id}/"
                    "regional-preview",
                    params={"term": "leche"},
                    headers=bearer(admin_token),
                )

                assert response.status_code == 200, response.text

                responses.append(response.json())

        finally:
            app.dependency_overrides.pop(
                get_scraping_http,
                None,
            )

    first_offer = responses[0]["offers"][0]
    second_offer = responses[1]["offers"][0]

    assert first_offer["sku_id"] == "SKU-101"
    assert second_offer["sku_id"] == "SKU-101"

    assert Decimal(first_offer["current_price"]) == Decimal("1500")

    assert Decimal(second_offer["current_price"]) == Decimal("1800")

    assert responses[0]["location_id"] == str(location_ids[0])
    assert responses[1]["location_id"] == str(location_ids[1])

    # Regional previews must not save observations.
    async with SessionLocal() as db:
        listing_count = await db.scalar(select(func.count()).select_from(Listing))
        price_count = await db.scalar(select(func.count()).select_from(Price))

    assert listing_count == 0
    assert price_count == 0
