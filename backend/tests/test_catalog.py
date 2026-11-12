from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import CanonicalProduct, Listing, ProductCategory, Store, StoreCategory
from app.services.catalog import classify_category, fill_missing_catalog, parse_net_content


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("/Almacén/Infusiones/Café/", ProductCategory.ALMACEN),
        ("/Almacen/Lacteos/", ProductCategory.LACTEOS),
        ("/Lácteos y productos frescos/Leches/", ProductCategory.LACTEOS),
        ("/Bebidas/Gaseosas/", ProductCategory.BEBIDAS),
        ("/Limpieza/Cuidado de la ropa/", ProductCategory.LIMPIEZA),
        ("Electro > TV", ProductCategory.ELECTRO),
        ("/Tecnología/Celulares/", ProductCategory.ELECTRO),
        ("/Textil/Calzado/", ProductCategory.INDUMENTARIA),
        ("/Mascotas/", None),
        ("", None),
        (None, None),
    ],
)
def test_classify_category(source: str | None, expected: ProductCategory | None) -> None:
    assert classify_category(source) == expected


@pytest.mark.parametrize(
    ("name", "amount", "unit", "label"),
    [
        ("Café Molido Intenso x450g", "450", "g", "450 g"),
        ("Leche Entera 1 Litro", "1000", "ml", "1 L"),
        ("Aceite de girasol 1,5 L", "1500", "ml", "1,5 L"),
        ("Gaseosa cola 2.25 lt", "2250", "ml", "2,25 L"),
        ("Detergente Limón 750 ml", "750", "ml", "750 ml"),
        ("Yerba Mate Suave 1kg", "1000", "g", "1 kg"),
        ("Arroz 1.000 g", "1000", "g", "1000 g"),
        ("Shampoo 400 cc", "400", "ml", "400 ml"),
    ],
)
def test_parse_net_content(name: str, amount: str, unit: str, label: str) -> None:
    content = parse_net_content(name)
    assert content is not None
    assert content.amount == Decimal(amount)
    assert content.unit == unit
    assert content.label == label


@pytest.mark.parametrize(
    "name", ['Smart TV 4K 50"', "Zapatillas running talle 42", "Galletitas", None]
)
def test_parse_net_content_without_quantity(name: str | None) -> None:
    assert parse_net_content(name) is None


async def test_fill_missing_catalog_uses_listing_and_keeps_existing_values() -> None:
    async with SessionLocal() as db:
        store = Store(
            name="Tienda",
            slug="tienda",
            base_url="https://t.example.com",
            category=StoreCategory.SUPERMARKET,
            scraper_key="tienda",
        )
        old = CanonicalProduct(ean="00000000000001", name="Leche Entera 1 L")
        curated = CanonicalProduct(
            ean="00000000000002", name="Yerba 1 kg", category=ProductCategory.BEBIDAS
        )
        db.add_all([store, old, curated])
        await db.flush()
        db.add_all(
            [
                Listing(
                    store_id=store.id,
                    external_code=code,
                    name=product.name,
                    url=f"https://t.example.com/{code}",
                    source_category=source,
                    canonical_product_id=product.id,
                )
                for code, product, source in [
                    ("1", old, "/Lacteos/"),
                    ("2", curated, "/Almacen/"),
                ]
            ]
        )
        await db.commit()

        assert await fill_missing_catalog(db) == 2
        assert await fill_missing_catalog(db) == 0

        rows = {p.ean: p for p in await db.scalars(select(CanonicalProduct))}

    assert rows["00000000000001"].category == ProductCategory.LACTEOS
    assert rows["00000000000001"].content == "1 L"
    assert rows["00000000000001"].grammage == Decimal("1000")
    # A curated category is never replaced.
    assert rows["00000000000002"].category == ProductCategory.BEBIDAS
    assert rows["00000000000002"].content == "1 kg"
