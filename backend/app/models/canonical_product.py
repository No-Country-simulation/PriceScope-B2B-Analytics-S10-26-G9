from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import WithId, WithTimestamps


class CanonicalProduct(WithId, WithTimestamps, Base):
    """The real-world product, identified by GTIN. Groups listings across stores."""

    __tablename__ = "canonical_products"

    ean: Mapped[str] = mapped_column(String(14), unique=True)
    name: Mapped[str] = mapped_column(String(255))
