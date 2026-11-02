"""Verify independent price storage across e-commerce stores."""

from decimal import Decimal

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Listing, Price, Store, StoreCategory
from app.services.scraping import scrape_vtex_store


def sample_product(price: int) -> dict:
    return {
        "productName": "Leche entera 1 L",
        "link": "/leche-entera/p",
        "categories": ["/Lacteos/Leches/"],
        "items": [
            {
                "itemId": "SKU-100",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "1",
                        "sellerName": "Tienda propia",
                        "commertialOffer": {
                            "Price": price,
                            "ListPrice": price,
                            "AvailableQuantity": 10,
                        },
                    }
                ],
            }
        ],
    }


async def test_carrefour_and_jumbo_keep_independent_prices() -> None:
    """The same SKU in two stores must create separate listings."""

    prices_by_host = {
        "www.carrefour.com.ar": 2400,
        "www.jumbo.com.ar": 2200,
    }

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["ft"] == "leche"

        price = prices_by_host[request.url.host]

        return httpx.Response(
            200,
            json=[sample_product(price)],
        )

    async with (
        SessionLocal() as db,
        httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client,
    ):
        carrefour = Store(
            name="Carrefour",
            slug="carrefour",
            base_url="https://www.carrefour.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="carrefour",
            active=True,
        )

        jumbo = Store(
            name="Jumbo",
            slug="jumbo",
            base_url="https://www.jumbo.com.ar",
            category=StoreCategory.SUPERMARKET,
            scraper_key="jumbo",
            active=True,
        )

        db.add_all([carrefour, jumbo])
        await db.commit()

        for store in (carrefour, jumbo):
            result = await scrape_vtex_store(
                db,
                client,
                store=store,
                own_seller_ids={"1"},
                term="leche",
                page_size=5,
                max_pages=1,
            )

            assert result.observations_saved == 1

    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(
                    Store.slug,
                    Listing.external_code,
                    Price.local_price,
                    Price.location_id,
                )
                .join(
                    Listing,
                    Listing.store_id == Store.id,
                )
                .join(
                    Price,
                    Price.listing_id == Listing.id,
                )
            )
        ).all()

    assert len(rows) == 2

    prices = {(slug, sku): price for slug, sku, price, _ in rows}

    assert prices == {
        ("carrefour", "SKU-100"): Decimal("2400"),
        ("jumbo", "SKU-100"): Decimal("2200"),
    }

    assert all(location_id is None for _, _, _, location_id in rows)
