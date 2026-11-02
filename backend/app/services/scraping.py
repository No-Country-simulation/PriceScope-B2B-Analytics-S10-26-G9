"""Orchestrate VTEX extraction and price persistence."""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Store
from app.scrapers.vtex import parse_vtex_product
from app.scrapers.vtex_client import fetch_vtex_products
from app.services.prices import record_observation


@dataclass(frozen=True)
class ScrapeResult:
    """Summary of one store extraction."""

    store: str
    products_received: int
    observations_saved: int
    skipped_duplicates: int


async def scrape_vtex_store(
    db: AsyncSession,
    client: httpx.AsyncClient,
    *,
    store: Store,
    own_seller_ids: set[str],
    term: str | None = None,
    category_id: int | None = None,
    category_ids: list[int] | None = None,
    page_size: int = 50,
    max_pages: int = 2,
    pause: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> ScrapeResult:
    """Fetch and persist one bounded VTEX extraction atomically."""

    if not store.active:
        raise ValueError("Cannot scrape an inactive store")

    if not own_seller_ids:
        raise ValueError("Own seller IDs must be configured")

    # First fetch all requested product pages.
    if category_ids is not None:
        if term is not None or category_id is not None:
            raise ValueError("Invalid search mode")

        if (
            not 1 <= len(category_ids) <= 2
            or len(set(category_ids)) != len(category_ids)
            or any(type(value) is not int or value <= 0 for value in category_ids)
        ):
            raise ValueError("Invalid category IDs")

        products = []

        for index, current_category in enumerate(category_ids):
            if index:
                await pause(1.0)

            page_products = await fetch_vtex_products(
                client,
                base_url=store.base_url,
                category_id=current_category,
                page_size=page_size,
                max_pages=max_pages,
                pause=pause,
            )

            products.extend(page_products)

    else:
        products = await fetch_vtex_products(
            client,
            base_url=store.base_url,
            term=term,
            category_id=category_id,
            page_size=page_size,
            max_pages=max_pages,
            pause=pause,
        )

    # Normalize all products before writing to the database.
    seen_codes: set[str] = set()
    observations = []
    duplicates = 0

    for product in products:
        parsed = parse_vtex_product(
            product,
            store_id=store.id,
            base_url=store.base_url,
            own_seller_ids=own_seller_ids,
        )

        for observation in parsed:
            if observation.external_code in seen_codes:
                duplicates += 1
                continue

            seen_codes.add(observation.external_code)
            observations.append(observation)

    # Persist the entire extraction in one transaction.
    saved = 0

    try:
        for observation in observations:
            result = await record_observation(
                db,
                observation,
                commit=False,
            )

            if result is not None:
                saved += 1

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return ScrapeResult(
        store=store.slug,
        products_received=len(products),
        observations_saved=saved,
        skipped_duplicates=duplicates,
    )
