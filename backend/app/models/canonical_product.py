from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import ProductCategory
from app.models.mixins import WithId, WithTimestamps, enum_column


class CanonicalProduct(WithId, WithTimestamps, Base):
    """The real-world product, identified by GTIN. Groups listings across stores."""

    __tablename__ = "canonical_products"

    ean: Mapped[str] = mapped_column(String(14), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[ProductCategory | None] = mapped_column(
        enum_column(ProductCategory, "product_category"), index=True
    )
    brand: Mapped[str | None] = mapped_column(String(120))
    # Net content as shown ("500 g") and normalized to g or ml for unit prices.
    content: Mapped[str | None] = mapped_column(String(40))
    grammage: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    unit: Mapped[str | None] = mapped_column(String(10))
