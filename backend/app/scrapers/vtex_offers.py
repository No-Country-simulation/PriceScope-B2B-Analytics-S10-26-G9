"""Extract individual seller offers from regional VTEX results."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.scrapers.vtex import positive_decimal


@dataclass(frozen=True)
class VtexRegionalOffer:
    product_id: str | None
    product_name: str
    sku_id: str
    seller_id: str
    seller_name: str
    current_price: Decimal | None
    list_price: Decimal | None


def _identifier(value: object) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        return None

    return str(value).strip() or None


def extract_regional_offers(
    products: list[dict[str, Any]],
    *,
    max_offers: int = 30,
) -> tuple[list[VtexRegionalOffer], bool]:
    """Extract seller offers without modifying or storing prices."""

    if not 1 <= max_offers <= 100:
        raise ValueError("Invalid offer limit")

    results: list[VtexRegionalOffer] = []
    seen: set[tuple[str, str]] = set()

    for product in products:
        if not isinstance(product, dict):
            continue

        product_id = _identifier(product.get("productId"))

        raw_name = product.get("productName")
        product_name = (
            raw_name.strip() if isinstance(raw_name, str) and raw_name.strip() else "Sin nombre"
        )

        items = product.get("items")
        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            sku_id = _identifier(item.get("itemId"))
            if sku_id is None:
                continue

            sellers = item.get("sellers")
            if not isinstance(sellers, list):
                continue

            for seller in sellers:
                if not isinstance(seller, dict):
                    continue

                seller_id = _identifier(seller.get("sellerId"))
                if seller_id is None:
                    continue

                key = (sku_id, seller_id)

                if key in seen:
                    continue

                seen.add(key)

                if len(results) >= max_offers:
                    return results, True

                raw_seller_name = seller.get("sellerName")
                seller_name = (
                    raw_seller_name.strip()
                    if isinstance(raw_seller_name, str) and raw_seller_name.strip()
                    else "Sin nombre informado"
                )

                offer = seller.get("commertialOffer")
                if not isinstance(offer, dict):
                    offer = {}

                results.append(
                    VtexRegionalOffer(
                        product_id=product_id,
                        product_name=product_name,
                        sku_id=sku_id,
                        seller_id=seller_id,
                        seller_name=seller_name,
                        current_price=positive_decimal(offer.get("Price")),
                        list_price=positive_decimal(offer.get("ListPrice")),
                    )
                )

    return results, False
