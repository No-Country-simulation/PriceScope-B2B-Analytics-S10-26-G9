"""Analyze sellers from VTEX product responses."""

from dataclasses import dataclass, field
from typing import Any

from app.scrapers.vtex import positive_decimal


@dataclass(frozen=True)
class SellerSummary:
    seller_id: str
    seller_name: str
    sku_count: int
    priced_sku_count: int
    default_sku_count: int


@dataclass
class _SellerCounter:
    name: str = ""
    skus: set[str] = field(default_factory=set)
    priced_skus: set[str] = field(default_factory=set)
    default_skus: set[str] = field(default_factory=set)


def summarize_vtex_sellers(
    products: list[dict[str, Any]],
) -> list[SellerSummary]:
    """Summarize sellers without persisting products."""

    counters: dict[str, _SellerCounter] = {}

    for product in products:
        items = product.get("items")

        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            raw_sku = item.get("itemId")
            if isinstance(raw_sku, bool) or not isinstance(raw_sku, (str, int)):
                continue

            sku_id = str(raw_sku).strip()
            if not sku_id:
                continue

            sellers = item.get("sellers")
            if not isinstance(sellers, list):
                continue

            for seller in sellers:
                if not isinstance(seller, dict):
                    continue

                raw_id = seller.get("sellerId")
                if isinstance(raw_id, bool) or not isinstance(raw_id, (str, int)):
                    continue

                seller_id = str(raw_id).strip()
                if not seller_id:
                    continue

                counter = counters.setdefault(seller_id, _SellerCounter())

                name = seller.get("sellerName")
                if isinstance(name, str) and name.strip() and not counter.name:
                    counter.name = name.strip()

                counter.skus.add(sku_id)

                offer = seller.get("commertialOffer")
                if isinstance(offer, dict):
                    price = positive_decimal(offer.get("Price"))
                    if price is not None:
                        counter.priced_skus.add(sku_id)

                if seller.get("sellerDefault") is True:
                    counter.default_skus.add(sku_id)

    summaries = [
        SellerSummary(
            seller_id=seller_id,
            seller_name=counter.name or "Sin nombre informado",
            sku_count=len(counter.skus),
            priced_sku_count=len(counter.priced_skus),
            default_sku_count=len(counter.default_skus),
        )
        for seller_id, counter in counters.items()
    ]

    return sorted(
        summaries,
        key=lambda item: (-item.sku_count, item.seller_id),
    )
