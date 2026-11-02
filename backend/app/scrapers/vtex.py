import uuid
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urljoin, urlsplit

from app.services.prices import ScrapedObservation


def positive_decimal(value: object) -> Decimal | None:
    """Convert a positive JSON number to Decimal."""
    if value is None or isinstance(value, bool):
        return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None

    if not number.is_finite() or number <= 0:
        return None

    return number


def parse_vtex_product(
    product: dict[str, Any],
    *,
    store_id: uuid.UUID,
    base_url: str,
    own_seller_ids: set[str],
) -> list[ScrapedObservation]:
    """Convert a VTEX product into observations for its own seller."""

    if not own_seller_ids:
        raise ValueError("At least one own seller ID is required")

    name = product.get("productName")
    link = product.get("link")

    if not isinstance(name, str) or not name.strip():
        return []

    if not isinstance(link, str) or not link.strip():
        return []

    name = name.strip()
    url = urljoin(base_url.rstrip("/") + "/", link)

    # Only accept product links belonging to the configured store.
    source = urlsplit(base_url)
    destination = urlsplit(url)

    if (
        source.scheme != "https"
        or destination.scheme != "https"
        or source.hostname != destination.hostname
        or len(name) > 255
        or len(url) > 500
    ):
        return []

    categories = product.get("categories")
    category = None

    if isinstance(categories, list) and categories:
        first = categories[0]
        if isinstance(first, str) and len(first) <= 160:
            category = first

    items = product.get("items")
    if not isinstance(items, list):
        return []

    observations: list[ScrapedObservation] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        sku_id = str(item.get("itemId") or "").strip()
        if not sku_id or len(sku_id) > 120:
            continue

        sellers = item.get("sellers")
        if not isinstance(sellers, list):
            continue

        for seller in sellers:
            if not isinstance(seller, dict):
                continue

            if str(seller.get("sellerId")) not in own_seller_ids:
                continue

            offer = seller.get("commertialOffer")
            if not isinstance(offer, dict):
                continue

            price = positive_decimal(offer.get("Price"))
            if price is None:
                continue

            list_price = positive_decimal(offer.get("ListPrice"))
            if list_price is not None and list_price <= price:
                list_price = None

            quantity_value = offer.get("AvailableQuantity")

            try:
                quantity = Decimal(str(quantity_value))
            except (InvalidOperation, ValueError):
                quantity = Decimal("0")

            available = (
                quantity.is_finite() and quantity > 0 and offer.get("IsAvailable") is not False
            )

            unit = item.get("measurementUnit")
            if not isinstance(unit, str) or len(unit) > 10:
                unit = None

            observations.append(
                ScrapedObservation(
                    store_id=store_id,
                    external_code=sku_id,
                    name=name,
                    url=url,
                    current_price=price,
                    strikethrough_price=list_price,
                    available=available,
                    category=category,
                    unit=unit,
                )
            )

            # One observation per SKU; ignore other sellers.
            break

    return observations
