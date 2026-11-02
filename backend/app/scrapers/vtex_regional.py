"""Regionalized VTEX Intelligent Search v1 client."""

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.models import StoreLocation
from app.scrapers.vtex_client import (
    USER_AGENT,
    VtexFetchError,
)

SEARCH_V1_PATH = "/api/intelligent-search/v1/product-search"


@dataclass(frozen=True)
class VtexRegionalContext:
    sales_channel: str
    region_id: str


def context_from_location(
    location: StoreLocation,
) -> VtexRegionalContext:
    """Prepare a regional context from a configured location."""

    if not location.active:
        raise ValueError("La ubicación está inactiva")

    # A region is not necessarily an individual pickup branch.
    if location.fulfillment_mode != "delivery":
        raise ValueError(
            "El retiro en sucursal necesita validar su identificador de punto de retiro"
        )

    sales_channel = (location.sales_channel or "").strip()
    region_id = (location.region_id or "").strip()

    if not sales_channel.isdecimal() or int(sales_channel) <= 0:
        raise ValueError("Falta configurar un canal comercial válido")

    if not region_id:
        raise ValueError("Falta configurar region_id")

    return VtexRegionalContext(
        sales_channel=sales_channel,
        region_id=region_id,
    )


async def fetch_vtex_regional_products(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    term: str,
    context: VtexRegionalContext,
) -> list[dict[str, Any]]:
    """Fetch a sample from Intelligent Search v1."""

    parsed = urlsplit(base_url)

    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Invalid HTTPS store origin")

    clean_term = term.strip()

    if len(clean_term) < 2:
        raise ValueError("Search term is too short")

    if (
        not context.sales_channel.isdecimal()
        or int(context.sales_channel) <= 0
        or not context.region_id.strip()
    ):
        raise ValueError("Invalid regional context")

    url = base_url.rstrip("/") + SEARCH_V1_PATH

    params = {
        "query": clean_term,
        "sc": context.sales_channel,
        "regionId": context.region_id,
        "count": 5,
        "page": 1,
    }

    try:
        response = await client.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=15.0,
        )

    except httpx.RequestError as exc:
        raise VtexFetchError(f"Regional search network error: {type(exc).__name__}") from exc

    if response.status_code != 200:
        raise VtexFetchError(f"Regional search HTTP status: {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise VtexFetchError("Regional search returned invalid JSON") from exc

    if not isinstance(payload, dict):
        raise VtexFetchError("Regional search returned an invalid response")

    products = payload.get("products")

    if not isinstance(products, list) or not all(isinstance(product, dict) for product in products):
        raise VtexFetchError("Regional search returned invalid products")

    return products
