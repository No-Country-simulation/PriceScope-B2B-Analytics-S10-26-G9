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


def normalize_ean(value: object) -> str | None:
    """Return a zero-padded GTIN-14, or None if the value is not a usable code."""
    if not isinstance(value, str):
        return None
    code = value.strip()
    if not (code.isascii() and code.isdigit() and 8 <= len(code) <= 14):
        return None
    return code.zfill(14)


def image_url(item: dict[str, Any]) -> str | None:
    """First HTTPS image of a VTEX SKU, or None."""
    images = item.get("images")
    if not isinstance(images, list):
        return None
    for image in images:
        if not isinstance(image, dict):
            continue
        url = image.get("imageUrl")
        if isinstance(url, str) and url.startswith("https://") and len(url) <= 500:
            return url
    return None


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

    brand = product.get("brand")
    if not isinstance(brand, str) or not brand.strip() or len(brand.strip()) > 120:
        brand = None
    else:
        brand = brand.strip()

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

        ean = normalize_ean(item.get("ean"))
        image = image_url(item)

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
                    ean=ean,
                    brand=brand,
                    image_url=image,
                )
            )

            # One observation per SKU; ignore other sellers.
            break

    return observations
