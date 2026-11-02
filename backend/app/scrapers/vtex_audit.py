"""Offline audit of previously collected VTEX samples."""

from dataclasses import dataclass

from app.scrapers.vtex_sellers import (
    SellerSummary,
    summarize_vtex_sellers,
)


@dataclass(frozen=True)
class VtexSampleAudit:
    product_count: int
    sku_count: int
    skus_with_ean: int
    distinct_eans: int
    sellers: tuple[SellerSummary, ...]


def audit_vtex_sample(data: object) -> VtexSampleAudit:
    """Audit VTEX JSON without network or database access."""

    if not isinstance(data, list) or any(not isinstance(product, dict) for product in data):
        raise ValueError("La muestra debe ser una lista JSON de productos")

    skus: set[str] = set()
    skus_with_ean: set[str] = set()
    eans: set[str] = set()

    for product in data:
        items = product.get("items")

        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            raw_sku = item.get("itemId")

            if isinstance(raw_sku, bool) or not isinstance(raw_sku, (str, int)):
                continue

            sku = str(raw_sku).strip()
            if not sku:
                continue

            skus.add(sku)

            ean = item.get("ean")

            if isinstance(ean, str) and ean.strip():
                skus_with_ean.add(sku)
                eans.add(ean.strip())

    return VtexSampleAudit(
        product_count=len(data),
        sku_count=len(skus),
        skus_with_ean=len(skus_with_ean),
        distinct_eans=len(eans),
        sellers=tuple(summarize_vtex_sellers(data)),
    )
