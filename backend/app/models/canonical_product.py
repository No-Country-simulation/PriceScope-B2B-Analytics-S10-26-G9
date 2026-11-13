import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import ProductCategory
from app.models.mixins import WithId, WithTimestamps, enum_column


class CanonicalProduct(WithId, WithTimestamps, Base):
    """The real-world product, identified by GTIN. Groups listings across stores.

    The EAN is optional: products created in curation may not have one.
    """

    __tablename__ = "canonical_products"
    __table_args__ = (
        # Curation suggestions look for similar names (services/curation.py).
        Index(
            "ix_canonical_products_name_trgm",
            text("lower(name) gin_trgm_ops"),
            postgresql_using="gin",
        ),
    )

    ean: Mapped[str | None] = mapped_column(String(14), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[ProductCategory | None] = mapped_column(
        enum_column(ProductCategory, "product_category"), index=True
    )
    brand: Mapped[str | None] = mapped_column(String(120))
    image_url: Mapped[str | None] = mapped_column(String(500))
    # Net content as shown ("500 g") and normalized to g or ml for unit prices.
    content: Mapped[str | None] = mapped_column(String(40))
    grammage: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    unit: Mapped[str | None] = mapped_column(String(10))


class CanonicalEanAlias(Base):
    """EAN of a canonical product merged into another one.

    The scrapers keep sending that EAN: it resolves to the surviving product instead of
    creating the duplicate again.
    """

    __tablename__ = "canonical_ean_aliases"

    ean: Mapped[str] = mapped_column(String(14), primary_key=True)
    canonical_product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("canonical_products.id", ondelete="CASCADE"), index=True
    )
