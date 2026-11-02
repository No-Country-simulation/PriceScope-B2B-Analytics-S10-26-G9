from unittest.mock import AsyncMock

import httpx
import pytest

from app.scrapers.vtex_client import (
    USER_AGENT,
    VtexFetchError,
    fetch_vtex_products,
)

BASE = "https://tienda.example.com"


async def test_two_pages_and_206() -> None:
    seen = []

    def respond(request: httpx.Request) -> httpx.Response:
        seen.append(request)

        if request.url.params["_from"] == "0":
            return httpx.Response(
                206,
                json=[
                    {"productName": "Producto A"},
                    {"productName": "Producto B"},
                ],
            )

        return httpx.Response(
            200,
            json=[{"productName": "Producto C"}],
        )

    pause = AsyncMock()

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        products = await fetch_vtex_products(
            client,
            base_url=BASE,
            term="leche",
            page_size=2,
            max_pages=4,
            pause=pause,
        )

    assert len(products) == 3
    assert products[0]["productName"] == "Producto A"
    assert products[2]["productName"] == "Producto C"

    assert [r.url.params["_from"] for r in seen] == [
        "0",
        "2",
    ]
    assert [r.url.params["_to"] for r in seen] == [
        "1",
        "3",
    ]

    assert seen[0].url.params["ft"] == "leche"
    assert seen[0].headers["user-agent"] == USER_AGENT

    pause.assert_awaited_once_with(1.0)


async def test_empty_page_stops_immediately() -> None:
    seen = []

    def respond(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        products = await fetch_vtex_products(
            client,
            base_url=BASE,
            term="leche",
        )

    assert products == []
    assert len(seen) == 1


async def test_max_pages_bounds_requests() -> None:
    seen = []

    def respond(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[{"id": 1}])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        products = await fetch_vtex_products(
            client,
            base_url=BASE,
            term="leche",
            page_size=1,
            max_pages=1,
        )

    assert len(products) == 1
    assert len(seen) == 1


@pytest.mark.parametrize("status", [403, 429, 503])
async def test_http_errors_are_rejected(status: int) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status)

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(
            VtexFetchError,
            match=str(status),
        ):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                term="leche",
            )


async def test_invalid_json_structure() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"products": []},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(
            VtexFetchError,
            match="invalid product list",
        ):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                term="leche",
            )


async def test_connection_failure() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout(
            "timeout",
            request=request,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(
            VtexFetchError,
            match="ConnectTimeout",
        ):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                term="leche",
            )


async def test_invalid_configuration() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(ValueError):
            await fetch_vtex_products(
                client,
                base_url="http://tienda.example.com",
                term="leche",
            )

        with pytest.raises(ValueError):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                term=" ",
            )

        with pytest.raises(ValueError):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                term="leche",
                page_size=100,
            )


async def test_category_search_uses_vtex_filter() -> None:
    requests = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            206,
            json=[{"productName": "Leche Entera"}],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        products = await fetch_vtex_products(
            client,
            base_url=BASE,
            category_id=123,
            page_size=10,
            max_pages=2,
        )

    assert len(products) == 1
    assert len(requests) == 1
    assert requests[0].url.params["fq"] == "C:123"
    assert "ft" not in requests[0].url.params


@pytest.mark.parametrize(
    "filters",
    [
        {},
        {"term": "leche", "category_id": 123},
        {"category_id": 0},
        {"category_id": True},
    ],
)
async def test_rejects_invalid_search_filters(
    filters: dict,
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[]))
    ) as client:
        with pytest.raises(ValueError):
            await fetch_vtex_products(
                client,
                base_url=BASE,
                **filters,
            )
