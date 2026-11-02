
"""HTTP client for VTEX catalogue searches."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlsplit

import httpx

SEARCH_PATH = "/api/catalog_system/pub/products/search"
USER_AGENT = "PriceScopeBot/0.1 (NoCountry academic project)"
MAX_SEARCH_WINDOW = 2500


class VtexFetchError(Exception):
    """Raised when a VTEX catalogue request fails."""


async def fetch_vtex_products(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    term: str | None = None,
    category_id: int | None = None,
    page_size: int = 50,
    max_pages: int = 2,
    pause: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> list[dict[str, Any]]:
    """Fetch bounded VTEX pages by search term or category."""

    origin = urlsplit(base_url)

    if (
        origin.scheme != "https"
        or not origin.hostname
        or origin.username is not None
        or origin.password is not None
        or origin.path not in ("", "/")
        or origin.query
        or origin.fragment
    ):
        raise ValueError("base_url must be a store HTTPS origin")

    # Exactly one search mode must be provided.
    if (term is None) == (category_id is None):
        raise ValueError(
            "Provide either term or category_id, not both"
        )

    params_filter: dict[str, str]

    if term is not None:
        if not isinstance(term, str) or not term.strip():
            raise ValueError("term must not be empty")

        params_filter = {"ft": term.strip()}
    else:
        if type(category_id) is not int or category_id <= 0:
            raise ValueError("category_id must be positive")

        params_filter = {"fq": f"C:{category_id}"}

    if not 1 <= page_size <= 50:
        raise ValueError("page_size must be between 1 and 50")

    if not 1 <= max_pages <= 50:
        raise ValueError("max_pages must be between 1 and 50")

    products: list[dict[str, Any]] = []
    url = base_url.rstrip("/") + SEARCH_PATH

    for page_index in range(max_pages):
        start = page_index * page_size

        if start >= MAX_SEARCH_WINDOW:
            break

        end = min(
            start + page_size - 1,
            MAX_SEARCH_WINDOW - 1,
        )

        if page_index:
            await pause(1.0)

        params: dict[str, str | int] = {
            **params_filter,
            "_from": start,
            "_to": end,
        }

        try:
            response = await client.get(
                url,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=15.0,
            )
        except httpx.RequestError as exc:
            raise VtexFetchError(
                f"Network error: {type(exc).__name__}"
            ) from exc

        if response.status_code not in (200, 206):
            raise VtexFetchError(
                f"Unexpected VTEX HTTP status: {response.status_code}"
            )

        try:
            page_products = response.json()
        except ValueError as exc:
            raise VtexFetchError(
                "VTEX returned invalid JSON"
            ) from exc

        if not isinstance(page_products, list) or not all(
            isinstance(product, dict)
            for product in page_products
        ):
            raise VtexFetchError(
                "VTEX returned an invalid product list"
            )

        products.extend(page_products)

        if len(page_products) < (end - start + 1):
            break

    return products
