"""Tests for VTEX scraping retry classification."""

import httpx
import pytest

from app.scrapers.vtex_client import (
    VtexFetchError,
    fetch_vtex_products,
)
from app.services.scraping_retry import (
    should_retry_vtex_error,
)

BASE_URL = "https://tienda.example.com"


@pytest.mark.parametrize(
    ("status_code", "expected"),
    [
        (500, True),
        (502, True),
        (503, True),
        (504, True),
        (429, False),
        (403, False),
        (404, False),
        (400, False),
    ],
)
async def test_classifies_http_failures(
    status_code: int,
    expected: bool,
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            headers={"Retry-After": "120"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(VtexFetchError) as exc_info:
            await fetch_vtex_products(
                client,
                base_url=BASE_URL,
                term="leche",
                page_size=5,
                max_pages=1,
            )

    error = exc_info.value

    assert error.status_code == status_code
    assert error.retry_after == "120"
    assert should_retry_vtex_error(error) is expected


async def test_connection_error_is_retryable() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(
            "Simulated connection failure",
            request=request,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(VtexFetchError) as exc_info:
            await fetch_vtex_products(
                client,
                base_url=BASE_URL,
                term="leche",
            )

    error = exc_info.value

    assert error.network_error is True
    assert should_retry_vtex_error(error) is True


async def test_invalid_json_is_not_retryable() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"invalid json",
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(VtexFetchError) as exc_info:
            await fetch_vtex_products(
                client,
                base_url=BASE_URL,
                term="leche",
            )

    assert should_retry_vtex_error(exc_info.value) is False
