from enum import StrEnum


class Role(StrEnum):
    CLIENT = "client"
    ADMIN = "admin"


class UserStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    BLOCKED = "blocked"
    DEACTIVATED = "deactivated"


class TokenType(StrEnum):
    SET_PASSWORD = "set_password"
    RESET_PASSWORD = "reset_password"


class OrganizationType(StrEnum):
    RETAIL = "retail"
    FUND = "fund"
    MEDIA = "media"
    OTHER = "other"


class StoreCategory(StrEnum):
    SUPERMARKET = "supermarket"
    ELECTRONICS = "electronics"
    FASHION = "fashion"


class ProductCategory(StrEnum):
    """Categories shown to clients. Store trees are mapped to these (services/catalog.py)."""

    ALMACEN = "almacen"
    BEBIDAS = "bebidas"
    LACTEOS = "lacteos"
    LIMPIEZA = "limpieza"
    ELECTRO = "electro"
    INDUMENTARIA = "indumentaria"


class RateType(StrEnum):
    OFFICIAL = "official"
    BLUE = "blue"


class AlertRuleKind(StrEnum):
    DEVALUATION = "devaluation"
    MILESTONE = "milestone"


class AlertRuleScope(StrEnum):
    CATEGORY = "category"
    PRODUCT = "product"


class MilestoneKey(StrEnum):
    CYBERWEEK = "cyberweek"
    BLACK_FRIDAY = "black_friday"
    HOT_SALE = "hot_sale"
    CUSTOM = "custom"


class MatchStatus(StrEnum):
    """State of a curation suggestion (listing → canonical product)."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    SEPARATED = "separated"


class CurationAction(StrEnum):
    MERGED = "merged"
    CONFIRMED = "confirmed"
    SEPARATED = "separated"
    CHOSEN = "chosen"
    CREATED = "created"
