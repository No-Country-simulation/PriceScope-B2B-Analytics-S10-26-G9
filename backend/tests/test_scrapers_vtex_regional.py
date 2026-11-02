import uuid

import httpx
import pytest

from app.models import StoreLocation
from app.scrapers.vtex_client import VtexFetchError
from app.scrapers.vtex_regional import (
    VtexRegionalContext,
    context_from_location,
    fetch_vtex_regional_products,
)

BASE_URL = "https://tienda.example.com"


def make_location(
    *,
    mode: str = "delivery",
    region_id: str | None = "region-test",
    sales_channel: str | None = "1",
    active: bool = True,
) -> StoreLocation:
    return StoreLocation(
        store_id=uuid.uuid4(),
        code="zona-prueba",
        name="Zona de prueba",
        fulfillment_mode=mode,
        region_id=region_id,
        sales_channel=sales_channel,
        active=active,
    )


def test_builds_regional_context() -> None:
    location = make_location()

    context = context_from_location(location)

    assert context.sales_channel == "1"
    assert context.region_id == "region-test"


@pytest.mark.parametrize(
    "changes",
    [
        {"mode": "pickup"},
        {"region_id": None},
        {"sales_channel": None},
        {"active": False},
    ],
)
def test_rejects_incomplete_location_context(
    changes: dict,
) -> None:
    location = make_location(**changes)

    with pytest.raises(ValueError):
        context_from_location(location)


async def test_regional_search_uses_explicit_parameters() -> None:
    requests = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)

        return httpx.Response(
            200,
            json={
                "products": [
                    {
                        "productId": "123",
                        "productName": "Leche de prueba",
                        "items": [],
                    }
                ],
                "recordsFiltered": 1,
            },
        )

    context = VtexRegionalContext(
        sales_channel="1",
        region_id="region-test",
    )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        products = await fetch_vtex_regional_products(
            client,
            base_url=BASE_URL,
            term="leche",
            context=context,
        )

    assert len(products) == 1
    assert len(requests) == 1

    request = requests[0]

    assert request.url.path == ("/api/intelligent-search/v1/product-search")
    assert request.url.params["query"] == "leche"
    assert request.url.params["sc"] == "1"
    assert request.url.params["regionId"] == "region-test"


@pytest.mark.parametrize("status", [403, 404, 429])
async def test_regional_search_http_errors(
    status: int,
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status))
    ) as client:
        with pytest.raises(
            VtexFetchError,
            match=str(status),
        ):
            await fetch_vtex_regional_products(
                client,
                base_url=BASE_URL,
                term="leche",
                context=VtexRegionalContext(
                    sales_channel="1",
                    region_id="region-test",
                ),
            )


async def test_rejects_invalid_products_structure() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"items": []},
            )
        )
    ) as client:
        with pytest.raises(
            VtexFetchError,
            match="invalid products",
        ):
            await fetch_vtex_regional_products(
                client,
                base_url=BASE_URL,
                term="leche",
                context=VtexRegionalContext(
                    sales_channel="1",
                    region_id="region-test",
                ),
            )
