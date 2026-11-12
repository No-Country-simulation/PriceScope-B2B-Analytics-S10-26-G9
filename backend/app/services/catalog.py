"""Catalog normalization: client category and net content of a product.

The parsing functions are pure. Scrapers and `record_observation` use them to fill
the canonical product the first time it is seen.
"""

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CanonicalProduct, Listing, ProductCategory

# Word prefixes that identify each category in the store trees ("/Almacen/Infusiones/").
_KEYWORDS: dict[ProductCategory, tuple[str, ...]] = {
    ProductCategory.LACTEOS: ("lacteo", "leche", "yogur", "queso", "manteca", "crema"),
    ProductCategory.BEBIDAS: ("bebida", "gaseosa", "agua", "vino", "cerveza", "jugo", "aperitivo"),
    ProductCategory.LIMPIEZA: ("limpieza", "detergente", "lavandina", "desinfectante"),
    ProductCategory.ELECTRO: (
        "electro",
        "tecnologia",
        "televisor",
        "tv",
        "heladera",
        "lavarropa",
        "celular",
        "informatica",
        "audio",
    ),
    # Not "textil": stores use it for home linen ("/Hogar y textil/").
    ProductCategory.INDUMENTARIA: (
        "indumentaria",
        "ropa",
        "calzado",
        "zapatilla",
        "moda",
    ),
    ProductCategory.ALMACEN: (
        "almacen",
        "despensa",
        "infusion",
        "cafe",
        "yerba",
        "aceite",
        "arroz",
        "fideo",
        "pasta",
        "galletita",
        "conserva",
    ),
}

# "Almacén" is a broad bucket in Argentine supermarkets: a deeper, more specific
# category ("/Almacen/Lacteos/") wins over it.
_SPECIFIC_UNDER_ALMACEN = (
    ProductCategory.LACTEOS,
    ProductCategory.BEBIDAS,
    ProductCategory.LIMPIEZA,
)


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def _segment_category(segment: str) -> ProductCategory | None:
    words = re.findall(r"[a-z0-9]+", _normalize(segment))
    for category, prefixes in _KEYWORDS.items():
        if any(word.startswith(prefix) for word in words for prefix in prefixes):
            return category
    return None


def classify_category(source_category: str | None) -> ProductCategory | None:
    """Map a store category path ("/Almacén/Infusiones/" or "Electro > TV") to a client category.

    The shallowest segment that matches wins, so "/Limpieza/Cuidado de la ropa/" stays in
    Limpieza. Returns None when nothing matches: the product goes to curation.
    """
    if not source_category:
        return None
    segments = [s for s in re.split(r"[/>|]", source_category) if s.strip()]
    found = None
    for segment in segments:
        category = _segment_category(segment)
        if category is None:
            continue
        if found is None:
            found = category
            if found != ProductCategory.ALMACEN:
                return found
        elif category in _SPECIFIC_UNDER_ALMACEN:
            return category
    return found


@dataclass(frozen=True)
class NetContent:
    """Net content of a product, normalized to grams, milliliters or units."""

    amount: Decimal
    unit: str  # "g", "ml" or "u"
    label: str  # as shown to clients: "500 g", "1,5 L"


_UNITS = {
    "kg": ("g", Decimal(1000), "kg"),
    "kgs": ("g", Decimal(1000), "kg"),
    "kilo": ("g", Decimal(1000), "kg"),
    "kilos": ("g", Decimal(1000), "kg"),
    "g": ("g", Decimal(1), "g"),
    "gr": ("g", Decimal(1), "g"),
    "grs": ("g", Decimal(1), "g"),
    "gramos": ("g", Decimal(1), "g"),
    "l": ("ml", Decimal(1000), "L"),
    "lt": ("ml", Decimal(1000), "L"),
    "lts": ("ml", Decimal(1000), "L"),
    "litro": ("ml", Decimal(1000), "L"),
    "litros": ("ml", Decimal(1000), "L"),
    "ml": ("ml", Decimal(1), "ml"),
    "cc": ("ml", Decimal(1), "ml"),
    "cm3": ("ml", Decimal(1), "ml"),
    "un": ("u", Decimal(1), "u"),
    "uni": ("u", Decimal(1), "u"),
    "unid": ("u", Decimal(1), "u"),
    "unidades": ("u", Decimal(1), "u"),
}

_CONTENT_RE = re.compile(
    r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(" + "|".join(sorted(_UNITS, key=len, reverse=True)) + r")\b"
)


def _to_decimal(raw: str) -> Decimal | None:
    # "1.000" is a thousands separator; "1.5" and "1,5" are decimals.
    if re.fullmatch(r"\d+\.\d{3}", raw):
        raw = raw.replace(".", "")
    try:
        return Decimal(raw.replace(",", "."))
    except InvalidOperation:
        return None


def _label(value: Decimal, unit: str) -> str:
    text = format(value.normalize(), "f").replace(".", ",")
    return f"{text} {unit}"


def content_label(amount: Decimal | None, unit: str | None) -> str | None:
    """Label of a normalized content: 450 g → "450 g", 1500 ml → "1,5 L"."""
    if amount is None or unit not in ("g", "ml", "u"):
        return None
    if amount >= 1000 and unit != "u":
        return _label(amount / 1000, "kg" if unit == "g" else "L")
    return _label(amount, unit)


def parse_net_content(name: str | None) -> NetContent | None:
    """Read the net content from a product name ("Café Molido x450g" → 450 g).

    Uses the last quantity in the name. Returns None when there is none (shoes, TVs).
    """
    if not name:
        return None
    matches = list(_CONTENT_RE.finditer(_normalize(name)))
    if not matches:
        return None
    raw, unit_text = matches[-1].groups()
    value = _to_decimal(raw)
    if value is None or value <= 0:
        return None
    base_unit, factor, label_unit = _UNITS[unit_text]
    return NetContent(
        amount=(value * factor).quantize(Decimal("0.001")),
        unit=base_unit,
        label=_label(value, label_unit),
    )


async def fill_missing_catalog(db: AsyncSession) -> int:
    """Fill category and net content of canonical products that predate these columns.

    Uses the most recently updated listing of each product. Never overwrites a value.
    Returns how many products changed. The brand is not stored in listings: the next
    scrape fills it.
    """
    products = await db.scalars(
        select(CanonicalProduct).where(
            or_(CanonicalProduct.category.is_(None), CanonicalProduct.content.is_(None))
        )
    )
    changed = 0
    for product in products:
        listing = await db.scalar(
            select(Listing)
            .where(Listing.canonical_product_id == product.id)
            .order_by(Listing.updated_at.desc())
            .limit(1)
        )
        before = (product.category, product.content)
        if product.category is None and listing is not None:
            product.category = classify_category(listing.source_category)
        if product.content is None:
            content = parse_net_content(product.name)
            if content is not None:
                product.content = content.label
                product.grammage = content.amount
                product.unit = content.unit
        if (product.category, product.content) != before:
            changed += 1
    await db.commit()
    return changed
