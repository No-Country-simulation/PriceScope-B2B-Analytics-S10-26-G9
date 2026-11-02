"""Prepare regional VTEX observations without database writes."""

from dataclasses import replace
from typing import Any

from app.models import Store, StoreLocation
from app.scrapers.vtex import parse_vtex_product
from app.scrapers.vtex_regional import (
    VtexRegionalContext,
    context_from_location,
)
from app.services.prices import ScrapedObservation


def prepare_regional_observations(
    products: list[dict[str, Any]],
    *,
    store: Store,
    location: StoreLocation,
    requested_context: VtexRegionalContext,
    own_seller_ids: set[str],
) -> list[ScrapedObservation]:
    """Normalize a regional response without saving anything."""

    if not store.active:
        raise ValueError("La tienda está inactiva")

    if not location.active or location.store_id != store.id:
        raise ValueError("La ubicación no pertenece a la tienda o está inactiva")

    if not own_seller_ids:
        raise ValueError("Faltan vendedores propios configurados")

    expected_context = context_from_location(location)

    if requested_context != expected_context:
        raise ValueError("El contexto solicitado no coincide con la ubicación")

    observations: list[ScrapedObservation] = []
    seen_codes: set[str] = set()

    for product in products:
        if not isinstance(product, dict):
            raise ValueError("El producto VTEX no es válido")

        parsed = parse_vtex_product(
            product,
            store_id=store.id,
            base_url=store.base_url,
            own_seller_ids=own_seller_ids,
        )

        for observation in parsed:
            if observation.external_code in seen_codes:
                continue

            seen_codes.add(observation.external_code)

            observations.append(
                replace(
                    observation,
                    location_id=location.id,
                )
            )

    return observations
