import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import (
    AlertRule,
    AlertRuleKind,
    AlertRuleScope,
    CanonicalEanAlias,
    CanonicalProduct,
    CurationEvent,
    Listing,
    ListingMatch,
    MatchStatus,
    ProductCategory,
    RateType,
    Role,
    Store,
    StoreCategory,
)
from app.services.curation import queue_unmatched
from app.services.prices import ScrapedObservation, record_observation
from tests.conftest import bearer, create_active_user

URL = "/api/v1/admin/curation"


def make_store(slug: str) -> Store:
    return Store(
        name=slug.title(),
        slug=slug,
        base_url=f"https://www.{slug}.com.ar",
        category=StoreCategory.SUPERMARKET,
        scraper_key=slug,
    )


async def observe(store: Store, code: str, name: str, **extra: object) -> None:
    async with SessionLocal() as db:
        await record_observation(
            db,
            ScrapedObservation(
                store_id=store.id,
                external_code=code,
                name=name,
                url=f"https://www.{store.slug}.com.ar/{code}",
                current_price=extra.pop("price", Decimal("1000")),
                **extra,
            ),
        )


async def listing(code: str) -> Listing:
    async with SessionLocal() as db:
        return await db.scalar(select(Listing).where(Listing.external_code == code))


async def match_of(code: str) -> ListingMatch | None:
    async with SessionLocal() as db:
        return await db.scalar(
            select(ListingMatch).join(Listing).where(Listing.external_code == code)
        )


@pytest.fixture
async def catalog() -> dict[str, Store]:
    """Carrefour publishes coffee and yerba with EAN; Jumbo publishes them without."""
    async with SessionLocal() as db:
        carrefour, jumbo = make_store("carrefour"), make_store("jumbo")
        db.add_all([carrefour, jumbo])
        await db.commit()
    await observe(
        carrefour,
        "C-CAFE",
        "Café molido Aroma 500 g",
        ean="7790000000401",
        brand="Aroma",
        category="/Almacén/Infusiones/",
        price=Decimal("9000"),
    )
    await observe(
        carrefour,
        "C-YERBA",
        "Yerba mate Monte Verde 1 kg",
        ean="7790000000770",
        brand="Monte Verde",
        category="/Almacén/",
    )
    await observe(
        jumbo,
        "J-CAFE",
        "Cafe Molido Aroma Intenso x500g",
        brand="Aroma",
        category="/Almacen/Infusiones/",
        price=Decimal("8500"),
    )
    await observe(jumbo, "J-YERBA", "Yerba Mate Suave 1kg", category="/Almacen/")
    await observe(jumbo, "J-RARO", "Producto sin parecido", category="/Varios/")
    return {"carrefour": carrefour, "jumbo": jumbo}


@pytest.fixture
async def admin(client: AsyncClient, admin_token: str) -> dict[str, str]:
    return bearer(admin_token)


async def queue_items(client: AsyncClient, headers: dict[str, str], **params: str) -> list[dict]:
    response = await client.get(f"{URL}/queue", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"]


async def item_for(client: AsyncClient, headers: dict[str, str], code: str) -> dict:
    return next(
        i for i in await queue_items(client, headers) if i["listing"]["external_code"] == code
    )


# --- Suggestions -------------------------------------------------------------------


async def test_listing_without_ean_is_queued_with_the_most_similar_product(catalog):
    coffee = await match_of("J-CAFE")
    assert coffee.status == MatchStatus.PENDING
    async with SessionLocal() as db:
        suggested = await db.get(CanonicalProduct, coffee.suggested_canonical_id)
    assert suggested.ean == "7790000000401"
    # Same brand and content add to the name similarity.
    yerba = await match_of("J-YERBA")
    assert coffee.score > yerba.score > 0
    # Nothing similar: queued without a suggestion.
    odd = await match_of("J-RARO")
    assert odd.suggested_canonical_id is None and odd.score is None
    # Listings with EAN never enter the queue.
    assert await match_of("C-CAFE") is None


async def test_scraping_again_does_not_duplicate_the_match(catalog):
    await observe(catalog["jumbo"], "J-CAFE", "Cafe Molido Aroma Intenso x500g", brand="Aroma")
    async with SessionLocal() as db:
        matches = (await db.scalars(select(ListingMatch))).all()
    assert len(matches) == 3


async def test_backfill_queues_listings_saved_before_curation(catalog):
    async with SessionLocal() as db:
        await db.execute(ListingMatch.__table__.delete())
        await db.commit()
        assert await queue_unmatched(db) == 3
        assert await queue_unmatched(db) == 0


# --- Queue -------------------------------------------------------------------------


async def test_queue_requires_admin(client: AsyncClient, client_token: str, catalog):
    response = await client.get(f"{URL}/queue", headers=bearer(client_token))
    assert response.status_code == 403


async def test_queue_orders_by_confidence_and_filters(client: AsyncClient, admin, catalog):
    response = await client.get(f"{URL}/queue", headers=admin)
    body = response.json()
    assert body["total"] == 3
    assert body["stores"] == [{"slug": "jumbo", "name": "Jumbo"}]
    assert body["categories"] == ["almacen"]
    assert body["uncategorized"] is True
    codes = [i["listing"]["external_code"] for i in body["items"]]
    assert codes == ["J-RARO", "J-YERBA", "J-CAFE"]

    coffee = body["items"][2]
    assert coffee["store"]["name"] == "Jumbo"
    assert coffee["listing"] | {"id": None, "url": None} == {
        "id": None,
        "name": "Cafe Molido Aroma Intenso x500g",
        "brand": "Aroma",
        "content": "500 g",
        "category": "almacen",
        "source_category": "/Almacen/Infusiones/",
        "external_code": "J-CAFE",
        "url": None,
        "price": "8500.00",
    }
    assert coffee["suggested"]["ean"] == "7790000000401"
    assert coffee["suggested"]["price"] == "9000.00"

    assert len(await queue_items(client, admin, category="almacen")) == 2
    assert await queue_items(client, admin, store="carrefour") == []


# --- Decisions ---------------------------------------------------------------------


async def test_confirm_links_the_listing_and_revert_undoes_it(client: AsyncClient, admin, catalog):
    coffee = await item_for(client, admin, "J-CAFE")
    response = await client.post(f"{URL}/queue/{coffee['id']}/confirm", headers=admin)
    assert response.status_code == 200, response.text
    event = response.json()
    assert event["action"] == "confirmed"
    assert event["admin"] == "Usuario de prueba"
    assert (
        event["after"] == "Cafe Molido Aroma Intenso x500g · Jumbo → Café molido Aroma 500 g 500 g"
    )
    assert event["revertible"] is True

    assert (await listing("J-CAFE")).canonical_product_id == uuid.UUID(coffee["suggested"]["id"])
    assert len(await queue_items(client, admin)) == 2
    again = await client.post(f"{URL}/queue/{coffee['id']}/confirm", headers=admin)
    assert again.status_code == 409

    # The scraper (no EAN) keeps the curated link.
    await observe(catalog["jumbo"], "J-CAFE", "Cafe Molido Aroma Intenso x500g")
    assert (await listing("J-CAFE")).canonical_product_id is not None

    response = await client.post(f"{URL}/history/{event['id']}/revert", headers=admin)
    assert response.status_code == 200, response.text
    assert response.json()["reverted"]["admin"] == "Usuario de prueba"
    assert (await listing("J-CAFE")).canonical_product_id is None
    assert (await match_of("J-CAFE")).status == MatchStatus.PENDING
    assert len(await queue_items(client, admin)) == 3


async def test_confirm_without_suggestion_is_rejected(client: AsyncClient, admin, catalog):
    odd = await item_for(client, admin, "J-RARO")
    response = await client.post(f"{URL}/queue/{odd['id']}/confirm", headers=admin)
    assert response.status_code == 409


async def test_separated_listing_is_not_queued_again(client: AsyncClient, admin, catalog):
    yerba = await item_for(client, admin, "J-YERBA")
    response = await client.post(f"{URL}/queue/{yerba['id']}/separate", headers=admin)
    assert response.json()["after"].endswith("→ sin vinculación")
    await observe(catalog["jumbo"], "J-YERBA", "Yerba Mate Suave 1kg")
    assert (await match_of("J-YERBA")).status == MatchStatus.SEPARATED
    assert (await listing("J-YERBA")).canonical_product_id is None
    assert len(await queue_items(client, admin)) == 2


async def test_choose_proposes_another_product(client: AsyncClient, admin, catalog):
    yerba = await item_for(client, admin, "J-YERBA")
    coffee = await item_for(client, admin, "J-CAFE")
    target = coffee["suggested"]["id"]

    response = await client.post(
        f"{URL}/queue/{coffee['id']}/choose",
        json={"canonical_id": yerba["suggested"]["id"]},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    assert response.json()["after"].endswith("(pendiente de confirmar)")
    first = await queue_items(client, admin)
    # Manual proposals go first and stay pending.
    assert first[0]["id"] == coffee["id"] and first[0]["manual"] is True
    assert first[0]["suggested"]["id"] == yerba["suggested"]["id"]

    same = await client.post(
        f"{URL}/queue/{coffee['id']}/choose",
        json={"canonical_id": yerba["suggested"]["id"]},
        headers=admin,
    )
    assert same.status_code == 409

    await client.post(f"{URL}/history/{response.json()['id']}/revert", headers=admin)
    restored = await item_for(client, admin, "J-CAFE")
    assert restored["manual"] is False and restored["suggested"]["id"] == target
    assert restored["score"] == coffee["score"]


async def test_create_proposes_a_new_product(client: AsyncClient, admin, catalog):
    odd = await item_for(client, admin, "J-RARO")
    duplicate = await client.post(
        f"{URL}/queue/{odd['id']}/create",
        json={"name": "Otro", "ean": "7790000000401"},
        headers=admin,
    )
    assert duplicate.status_code == 409
    invalid = await client.post(
        f"{URL}/queue/{odd['id']}/create", json={"name": "Otro", "ean": "12"}, headers=admin
    )
    assert invalid.status_code == 422

    response = await client.post(
        f"{URL}/queue/{odd['id']}/create",
        json={
            "name": "Producto raro",
            "brand": "Marca",
            "content": "750 ml",
            "category": "bebidas",
        },
        headers=admin,
    )
    assert response.status_code == 200, response.text
    proposed = (await item_for(client, admin, "J-RARO"))["suggested"]
    assert proposed["name"] == "Producto raro" and proposed["ean"] is None
    async with SessionLocal() as db:
        product = await db.get(CanonicalProduct, uuid.UUID(proposed["id"]))
        assert (product.grammage, product.unit) == (Decimal("750.000"), "ml")

    await client.post(f"{URL}/history/{response.json()['id']}/revert", headers=admin)
    async with SessionLocal() as db:
        assert await db.get(CanonicalProduct, uuid.UUID(proposed["id"])) is None
    assert (await item_for(client, admin, "J-RARO"))["suggested"] is None


# --- Merge -------------------------------------------------------------------------


async def test_merge_moves_everything_and_revert_restores_it(client: AsyncClient, admin, catalog):
    async with SessionLocal() as db:
        target = await db.scalar(
            select(CanonicalProduct).where(CanonicalProduct.ean == "7790000000401")
        )
        source = CanonicalProduct(
            ean="7790000000419", name="Café molido clásico", category=ProductCategory.ALMACEN
        )
        db.add(source)
        await db.flush()
        owner = await create_active_user("duenio@example.com", Role.CLIENT)
        rule = AlertRule(
            user_id=owner.id,
            name="Café",
            kind=AlertRuleKind.DEVALUATION,
            scope=AlertRuleScope.PRODUCT,
            canonical_product_id=source.id,
            rate_type=RateType.BLUE,
            threshold_pp=Decimal(2),
            period_days=30,
        )
        db.add(rule)
        await db.commit()
        source_id, target_id, rule_id = source.id, target.id, rule.id
    # A store publishes the duplicate with its own EAN.
    await observe(catalog["jumbo"], "J-CLASICO", "Café molido clásico 500 g", ean="7790000000419")

    response = await client.post(
        f"{URL}/canonical/merge",
        json={"source_id": str(source_id), "target_id": str(target_id)},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    assert response.json()["action"] == "merged"
    async with SessionLocal() as db:
        assert await db.get(CanonicalProduct, source_id) is None
        assert (await db.get(AlertRule, rule_id)).canonical_product_id == target_id
        assert (await db.get(CanonicalEanAlias, "7790000000419")).canonical_product_id == target_id
    assert (await listing("J-CLASICO")).canonical_product_id == target_id

    # The duplicate's EAN keeps feeding the product that absorbed it.
    await observe(catalog["jumbo"], "J-CLASICO", "Café molido clásico 500 g", ean="7790000000419")
    async with SessionLocal() as db:
        assert (
            await db.scalar(select(CanonicalProduct).where(CanonicalProduct.ean == "7790000000419"))
            is None
        )
    assert (await listing("J-CLASICO")).canonical_product_id == target_id

    response = await client.post(f"{URL}/history/{response.json()['id']}/revert", headers=admin)
    assert response.status_code == 200, response.text
    async with SessionLocal() as db:
        restored = await db.get(CanonicalProduct, source_id)
        assert (restored.ean, restored.name) == ("7790000000419", "Café molido clásico")
        assert (await db.get(AlertRule, rule_id)).canonical_product_id == source_id
        assert await db.get(CanonicalEanAlias, "7790000000419") is None
    assert (await listing("J-CLASICO")).canonical_product_id == source_id
    assert (await listing("C-CAFE")).canonical_product_id == target_id


async def test_merge_into_a_product_without_ean_moves_the_ean(client: AsyncClient, admin, catalog):
    odd = await item_for(client, admin, "J-RARO")
    created = await client.post(
        f"{URL}/queue/{odd['id']}/create", json={"name": "Café molido"}, headers=admin
    )
    assert created.status_code == 200
    target_id = (await item_for(client, admin, "J-RARO"))["suggested"]["id"]
    async with SessionLocal() as db:
        source_id = await db.scalar(
            select(CanonicalProduct.id).where(CanonicalProduct.ean == "7790000000770")
        )
    response = await client.post(
        f"{URL}/canonical/merge",
        json={"source_id": str(source_id), "target_id": target_id},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    async with SessionLocal() as db:
        target = await db.get(CanonicalProduct, uuid.UUID(target_id))
        assert target.ean == "7790000000770"
        # Empty attributes come from the duplicate.
        assert target.brand == "Monte Verde"
    await client.post(f"{URL}/history/{response.json()['id']}/revert", headers=admin)
    async with SessionLocal() as db:
        assert (await db.get(CanonicalProduct, uuid.UUID(target_id))).ean is None
        assert (await db.get(CanonicalProduct, source_id)).ean == "7790000000770"


async def test_merge_validates_the_products(client: AsyncClient, admin, catalog):
    same = str(uuid.uuid4())
    response = await client.post(
        f"{URL}/canonical/merge", json={"source_id": same, "target_id": same}, headers=admin
    )
    assert response.status_code == 400
    response = await client.post(
        f"{URL}/canonical/merge",
        json={"source_id": str(uuid.uuid4()), "target_id": str(uuid.uuid4())},
        headers=admin,
    )
    assert response.status_code == 404


# --- History and catalog -----------------------------------------------------------


async def test_only_the_latest_change_can_be_reverted(client: AsyncClient, admin, catalog):
    coffee = await item_for(client, admin, "J-CAFE")
    yerba = await item_for(client, admin, "J-YERBA")
    first = (await client.post(f"{URL}/queue/{coffee['id']}/confirm", headers=admin)).json()
    second = (await client.post(f"{URL}/queue/{yerba['id']}/separate", headers=admin)).json()

    history = (await client.get(f"{URL}/history", headers=admin)).json()
    assert [e["id"] for e in history] == [second["id"], first["id"]]
    assert [e["revertible"] for e in history] == [True, False]

    response = await client.post(f"{URL}/history/{first['id']}/revert", headers=admin)
    assert response.status_code == 409
    await client.post(f"{URL}/history/{second['id']}/revert", headers=admin)
    again = await client.post(f"{URL}/history/{second['id']}/revert", headers=admin)
    assert again.status_code == 409
    history = (await client.get(f"{URL}/history", headers=admin)).json()
    assert [e["revertible"] for e in history] == [False, True]
    assert history[0]["reverted"] is not None
    async with SessionLocal() as db:
        assert len((await db.scalars(select(CurationEvent))).all()) == 2


async def test_search_canonical(client: AsyncClient, admin, catalog):
    response = await client.get(f"{URL}/canonical", params={"q": "cafe molido"}, headers=admin)
    assert [p["ean"] for p in response.json()] == ["7790000000401"]
    response = await client.get(f"{URL}/canonical", params={"q": "0770"}, headers=admin)
    assert [p["name"] for p in response.json()] == ["Yerba mate Monte Verde 1 kg"]
    everything = (await client.get(f"{URL}/canonical", headers=admin)).json()
    excluded = await client.get(
        f"{URL}/canonical", params={"exclude": everything[0]["id"]}, headers=admin
    )
    assert len(excluded.json()) == len(everything) - 1
