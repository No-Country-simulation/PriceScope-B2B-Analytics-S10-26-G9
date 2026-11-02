import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import ScrapingRun, Store, StoreCategory
from tests.conftest import bearer

URL = "/api/v1/admin/scraping/runs"


async def test_history_requires_admin(
    client: httpx.AsyncClient,
    client_token: str,
) -> None:
    response = await client.get(URL)
    assert response.status_code == 401

    response = await client.get(
        URL,
        headers=bearer(client_token),
    )
    assert response.status_code == 403


async def test_admin_can_filter_scraping_history(
    client: httpx.AsyncClient,
    admin_token: str,
) -> None:
    async with SessionLocal() as db:
        store = Store(
            name="Carrefour de prueba",
            slug="carrefour",
            base_url="https://www.carrefour.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="carrefour",
            active=True,
        )

        db.add(store)
        await db.flush()

        db.add_all(
            [
                ScrapingRun(
                    store_id=store.id,
                    status="success",
                    search_mode="term",
                    search_value="leche",
                    products_received=5,
                    observations_saved=5,
                ),
                ScrapingRun(
                    store_id=store.id,
                    status="failed",
                    search_mode="term",
                    search_value="leche",
                    error_code="VTEX_FETCH_ERROR",
                    error_message="HTTP status: 429",
                ),
            ]
        )

        await db.commit()

    response = await client.get(
        URL,
        params={
            "store_slug": "carrefour",
            "status": "failed",
            "limit": 1,
            "offset": 0,
        },
        headers=bearer(admin_token),
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["total"] == 1
    assert data["limit"] == 1
    assert len(data["items"]) == 1

    run = data["items"][0]

    assert run["store_slug"] == "carrefour"
    assert run["status"] == "failed"
    assert run["search_mode"] == "term"
    assert run["error_code"] == "VTEX_FETCH_ERROR"

    async with SessionLocal() as db:
        total_runs = (await db.scalars(select(ScrapingRun))).all()

    assert len(total_runs) == 2
