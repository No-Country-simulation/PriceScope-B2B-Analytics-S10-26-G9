"""Admin-only endpoints for controlled scraping."""

import uuid
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentAdmin, DbSession
from app.core.config import settings
from app.models import Store
from app.schemas.scraping import (
    ScrapeCategoriesOutput,
    ScrapeCategoryOutput,
    ScrapeRegionalOfferOutput,
    ScrapeRegionalPreviewOutput,
    ScrapeRegionalProductOutput,
    ScrapeRunInput,
    ScrapeRunOutput,
    ScrapeSellerOutput,
    ScrapeSellerPreviewOutput,
    ScrapeStoreReadinessOutput,
)
from app.scrapers.vtex_categories import fetch_vtex_categories
from app.scrapers.vtex_client import VtexFetchError, fetch_vtex_products
from app.scrapers.vtex_offers import extract_regional_offers
from app.scrapers.vtex_regional import (
    context_from_location,
    fetch_vtex_regional_products,
)
from app.scrapers.vtex_sellers import summarize_vtex_sellers
from app.services.scraping import scrape_vtex_store
from app.services.scraping_lock import (
    ScrapeAlreadyRunningError,
    scrape_store_lock,
)
from app.services.scraping_rate_limit import throttle_scraping_request
from app.services.store_locations import get_active_location

router = APIRouter(
    prefix="/admin/scraping",
    tags=["admin · scraping"],
)

APPROVED_ORIGINS = {
    "carrefour": "https://www.carrefour.com.ar",
    "jumbo": "https://www.jumbo.com.ar",
}


def configured_seller_ids(store_slug: str) -> set[str]:
    """Read non-empty seller IDs from store configuration."""

    values = settings.scraping_seller_ids.get(store_slug, [])

    return {value.strip() for value in values if isinstance(value, str) and value.strip()}


async def get_scraping_http() -> AsyncIterator[httpx.AsyncClient]:
    """HTTP client with distributed per-store rate limiting."""

    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=False,
        trust_env=False,
        event_hooks={
            "request": [throttle_scraping_request],
        },
    ) as client:
        yield client


ScrapingHttp = Annotated[
    httpx.AsyncClient,
    Depends(get_scraping_http),
]


async def get_approved_store(
    db: AsyncSession,
    slug: str,
) -> Store:
    """Validate store and explicit scraping approval."""

    store = await db.scalar(select(Store).where(Store.slug == slug))

    if store is None or not store.active:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "La tienda no existe o está inactiva",
        )

    if not settings.scraping_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "La extracción real todavía no está habilitada",
        )

    # Global enablement does not approve individual stores.
    if store.slug not in settings.scraping_allowed_stores:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "La tienda no está habilitada para extracción",
        )

    expected_origin = APPROVED_ORIGINS.get(store.slug)

    if expected_origin is None or store.base_url.rstrip("/") != expected_origin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "La tienda no está aprobada para extracción",
        )

    return store


@router.get(
    "/stores/{store_slug}/categories",
    response_model=ScrapeCategoriesOutput,
    summary="List store categories",
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not an administrator or store not approved"},
        404: {"description": "Store not found or inactive"},
        422: {"description": "Invalid query parameters"},
        502: {"description": "Category source failed"},
        503: {"description": "Scraping not enabled"},
    },
)
async def list_categories(
    store_slug: str,
    db: DbSession,
    _admin: CurrentAdmin,
    http: ScrapingHttp,
    levels: Annotated[int, Query(ge=1, le=3)] = 3,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ScrapeCategoriesOutput:
    store = await get_approved_store(db, store_slug)

    try:
        categories = await fetch_vtex_categories(
            http,
            base_url=store.base_url,
            levels=levels,
        )
    except VtexFetchError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "No se pudo obtener el árbol de categorías",
        ) from exc

    total = len(categories)
    selected = categories[offset : offset + limit]

    return ScrapeCategoriesOutput(
        store=store.slug,
        total=total,
        offset=offset,
        limit=limit,
        has_more=offset + limit < total,
        items=[
            ScrapeCategoryOutput(
                id=category.id,
                name=category.name,
                level=category.level,
                path=category.path,
                has_children=category.has_children,
            )
            for category in selected
        ],
    )


@router.post(
    "/run",
    response_model=ScrapeRunOutput,
    summary="Run a controlled store extraction",
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not an administrator or store not approved"},
        404: {"description": "Store not found or inactive"},
        409: {"description": "A scraping run for this store is already active"},
        422: {"description": "Invalid request parameters"},
        502: {"description": "The catalogue source failed"},
        503: {"description": "Scraping not enabled or not configured"},
    },
)
async def run_scraping(
    data: ScrapeRunInput,
    db: DbSession,
    _admin: CurrentAdmin,
    http: ScrapingHttp,
) -> ScrapeRunOutput:
    store = await get_approved_store(
        db,
        data.store_slug,
    )

    seller_ids = configured_seller_ids(store.slug)

    if not seller_ids:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "No hay vendedores propios configurados",
        )

    try:
        async with scrape_store_lock(store.id):
            result = await scrape_vtex_store(
                db,
                http,
                store=store,
                term=data.term,
                category_id=data.category_id,
                category_ids=data.category_ids,
                own_seller_ids=seller_ids,
                page_size=data.page_size,
                max_pages=data.max_pages,
            )

    except ScrapeAlreadyRunningError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe una extracción en curso para esta tienda",
        ) from exc

    except VtexFetchError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "No se pudo obtener el catálogo de la tienda",
        ) from exc

    return ScrapeRunOutput(
        store=result.store,
        products_received=result.products_received,
        observations_saved=result.observations_saved,
        skipped_duplicates=result.skipped_duplicates,
    )


@router.get(
    "/stores/{store_slug}/sellers/preview",
    response_model=ScrapeSellerPreviewOutput,
    summary="Preview VTEX sellers without saving prices",
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not an administrator or store not approved"},
        404: {"description": "Store not found or inactive"},
        422: {"description": "Invalid search parameters"},
        502: {"description": "Catalogue source failed"},
        503: {"description": "Scraping not enabled"},
    },
)
async def preview_sellers(
    store_slug: str,
    db: DbSession,
    _admin: CurrentAdmin,
    http: ScrapingHttp,
    term: Annotated[str, Query(min_length=2, max_length=60)] = "leche",
    page_size: Annotated[int, Query(ge=1, le=20)] = 10,
    max_pages: Annotated[int, Query(ge=1, le=2)] = 1,
) -> ScrapeSellerPreviewOutput:
    """Inspect seller IDs in a bounded sample."""

    store = await get_approved_store(db, store_slug)

    clean_term = term.strip()

    if len(clean_term) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El término debe tener al menos 2 caracteres",
        )

    try:
        products = await fetch_vtex_products(
            http,
            base_url=store.base_url,
            term=clean_term,
            page_size=page_size,
            max_pages=max_pages,
        )
    except VtexFetchError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "No se pudo consultar los vendedores",
        ) from exc

    summaries = summarize_vtex_sellers(products)

    return ScrapeSellerPreviewOutput(
        store=store.slug,
        products_received=len(products),
        sellers=[
            ScrapeSellerOutput(
                seller_id=item.seller_id,
                seller_name=item.seller_name,
                sku_count=item.sku_count,
                priced_sku_count=item.priced_sku_count,
                default_sku_count=item.default_sku_count,
            )
            for item in summaries
        ],
    )


@router.get(
    "/stores/readiness",
    response_model=list[ScrapeStoreReadinessOutput],
    summary="Inspect technical scraping configuration",
)
async def scraping_readiness(
    db: DbSession,
    _admin: CurrentAdmin,
) -> list[ScrapeStoreReadinessOutput]:
    """Report configuration without contacting external stores."""

    stores = (await db.scalars(select(Store).order_by(Store.slug))).all()

    results = []

    for store in stores:
        globally_enabled = settings.scraping_enabled

        individually_enabled = store.slug in settings.scraping_allowed_stores

        expected_origin = APPROVED_ORIGINS.get(store.slug)

        origin_matches = (
            expected_origin is not None and store.base_url.rstrip("/") == expected_origin
        )

        seller_ids = configured_seller_ids(store.slug)
        issues: list[str] = []

        if not store.active:
            issues.append("La tienda está inactiva")

        if not globally_enabled:
            issues.append("Scraping global deshabilitado")

        if not individually_enabled:
            issues.append("Tienda no habilitada individualmente")

        if not origin_matches:
            issues.append("Origen no configurado o diferente")

        if not seller_ids:
            issues.append("Faltan identificadores de vendedores")

        results.append(
            ScrapeStoreReadinessOutput(
                store_slug=store.slug,
                store_active=store.active,
                globally_enabled=globally_enabled,
                individually_enabled=individually_enabled,
                origin_matches=origin_matches,
                configured_seller_count=len(seller_ids),
                technically_ready=not issues,
                issues=issues,
            )
        )

    return results


@router.get(
    "/stores/{store_slug}/locations/{location_id}/regional-preview",
    response_model=ScrapeRegionalPreviewOutput,
    summary="Preview a regional VTEX search without saving prices",
)
async def preview_regional_products(
    store_slug: str,
    location_id: uuid.UUID,
    db: DbSession,
    _admin: CurrentAdmin,
    http: ScrapingHttp,
    term: Annotated[str, Query(min_length=2, max_length=60)] = "leche",
) -> ScrapeRegionalPreviewOutput:
    """Inspect a configured location using regional search."""

    store = await get_approved_store(db, store_slug)

    location = await get_active_location(
        db,
        store.id,
        location_id,
    )

    try:
        context = context_from_location(location)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            str(exc),
        ) from exc

    clean_term = term.strip()

    if len(clean_term) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El término debe tener al menos 2 caracteres",
        )

    try:
        products = await fetch_vtex_regional_products(
            http,
            base_url=store.base_url,
            term=clean_term,
            context=context,
        )
    except VtexFetchError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "No se pudo consultar el catálogo regional",
        ) from exc

    summaries = summarize_vtex_sellers(products)
    offers, truncated = extract_regional_offers(
        products,
        max_offers=30,
    )

    product_samples = []

    for product in products[:5]:
        raw_id = product.get("productId")
        raw_name = product.get("productName")

        product_samples.append(
            ScrapeRegionalProductOutput(
                product_id=(
                    str(raw_id)
                    if isinstance(raw_id, (str, int)) and not isinstance(raw_id, bool)
                    else None
                ),
                name=(raw_name if isinstance(raw_name, str) else "Sin nombre"),
            )
        )

    return ScrapeRegionalPreviewOutput(
        store=store.slug,
        location_id=location.id,
        location_code=location.code,
        sales_channel=context.sales_channel,
        region_id=context.region_id,
        products_received=len(products),
        products=product_samples,
        sellers=[
            ScrapeSellerOutput(
                seller_id=seller.seller_id,
                seller_name=seller.seller_name,
                sku_count=seller.sku_count,
                priced_sku_count=seller.priced_sku_count,
                default_sku_count=seller.default_sku_count,
            )
            for seller in summaries
        ],
        offers=[
            ScrapeRegionalOfferOutput(
                product_id=offer.product_id,
                product_name=offer.product_name,
                sku_id=offer.sku_id,
                seller_id=offer.seller_id,
                seller_name=offer.seller_name,
                current_price=offer.current_price,
                list_price=offer.list_price,
            )
            for offer in offers
        ],
        offers_truncated=truncated,
    )
