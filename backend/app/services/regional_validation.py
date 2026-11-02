"""Compare two authorized VTEX regional samples offline."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from app.scrapers.vtex_offers import extract_regional_offers

MAX_CAPTURE_DIFFERENCE = timedelta(minutes=15)


@dataclass(frozen=True)
class RegionalSnapshot:
    store_slug: str
    location_code: str
    region_id: str
    sales_channel: str
    captured_at: datetime
    products: list[dict[str, Any]]


@dataclass(frozen=True)
class PriceDifference:
    sku_id: str
    seller_id: str
    price_a: Decimal
    price_b: Decimal


@dataclass(frozen=True)
class RegionalComparison:
    store_slug: str
    location_a: str
    location_b: str
    shared_offers: int
    equal_prices: int
    only_a: int
    only_b: int
    differences: tuple[PriceDifference, ...]


def parse_regional_snapshot(data: object) -> RegionalSnapshot:
    """Validate a local JSON snapshot and its declared metadata."""

    if not isinstance(data, dict):
        raise ValueError("La muestra debe ser un objeto JSON")

    required = (
        "store_slug",
        "location_code",
        "region_id",
        "sales_channel",
        "captured_at",
    )

    for name in required:
        value = data.get(name)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Falta el campo {name}")

    products = data.get("products")

    if not isinstance(products, list) or any(not isinstance(product, dict) for product in products):
        raise ValueError("El campo products no es válido")

    try:
        captured_at = datetime.fromisoformat(data["captured_at"])
    except ValueError as exc:
        raise ValueError("captured_at no tiene una fecha válida") from exc

    if captured_at.tzinfo is None or captured_at.utcoffset() is None:
        raise ValueError("captured_at debe incluir la zona horaria")

    return RegionalSnapshot(
        store_slug=data["store_slug"].strip(),
        location_code=data["location_code"].strip(),
        region_id=data["region_id"].strip(),
        sales_channel=data["sales_channel"].strip(),
        captured_at=captured_at,
        products=products,
    )


def _priced_offers(
    snapshot: RegionalSnapshot,
) -> dict[tuple[str, str], Decimal]:
    offers, truncated = extract_regional_offers(
        snapshot.products,
        max_offers=100,
    )

    if truncated:
        raise ValueError("La muestra supera el límite de 100 ofertas")

    return {
        (offer.sku_id, offer.seller_id): offer.current_price
        for offer in offers
        if offer.current_price is not None
    }


def compare_regional_snapshots(
    first: RegionalSnapshot,
    second: RegionalSnapshot,
) -> RegionalComparison:
    """Compare equal SKU/seller pairs across two regions."""

    if first.store_slug != second.store_slug:
        raise ValueError("Las muestras pertenecen a distintas tiendas")

    if first.location_code == second.location_code:
        raise ValueError("Las muestras deben tener ubicaciones diferentes")

    if first.region_id == second.region_id and first.sales_channel == second.sales_channel:
        raise ValueError("Las muestras tienen el mismo contexto VTEX")

    difference_in_time = abs(first.captured_at - second.captured_at)

    if difference_in_time > MAX_CAPTURE_DIFFERENCE:
        raise ValueError("Las muestras tienen más de 15 minutos de diferencia")

    a = _priced_offers(first)
    b = _priced_offers(second)

    shared = set(a) & set(b)
    differences = []

    for sku_id, seller_id in sorted(shared):
        price_a = a[(sku_id, seller_id)]
        price_b = b[(sku_id, seller_id)]

        if price_a != price_b:
            differences.append(
                PriceDifference(
                    sku_id=sku_id,
                    seller_id=seller_id,
                    price_a=price_a,
                    price_b=price_b,
                )
            )

    return RegionalComparison(
        store_slug=first.store_slug,
        location_a=first.location_code,
        location_b=second.location_code,
        shared_offers=len(shared),
        equal_prices=len(shared) - len(differences),
        only_a=len(set(a) - set(b)),
        only_b=len(set(b) - set(a)),
        differences=tuple(differences),
    )
