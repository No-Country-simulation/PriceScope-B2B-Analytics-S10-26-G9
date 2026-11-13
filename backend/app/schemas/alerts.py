import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import AlertRuleKind, AlertRuleScope, MilestoneKey, ProductCategory, RateType


class RuleConditions(BaseModel):
    """What a rule watches. Shared by create, edit and preview.

    Only types are checked here: the cross-field rules live in services/alerts.py,
    so every error comes back as a single Spanish `detail`.
    """

    kind: AlertRuleKind = AlertRuleKind.DEVALUATION
    scope: AlertRuleScope = AlertRuleScope.CATEGORY
    category: ProductCategory | None = None
    canonical_product_id: uuid.UUID | None = None
    store_id: uuid.UUID | None = Field(default=None, description="null = any of the user's stores.")
    rate_type: RateType = RateType.BLUE
    threshold_pp: Decimal = Decimal(2)
    period_days: int | None = Field(default=30, description="7, 30 or 90 (devaluation only).")
    milestone_key: MilestoneKey | None = None
    starts_on: date | None = None
    ends_on: date | None = None


class AlertRuleInput(RuleConditions):
    name: str
    notify_in_app: bool = True
    notify_email: bool = False


class AlertRulePatch(BaseModel):
    """Edit or pause/resume a rule. Only the fields sent change."""

    name: str | None = None
    kind: AlertRuleKind | None = None
    scope: AlertRuleScope | None = None
    category: ProductCategory | None = None
    canonical_product_id: uuid.UUID | None = None
    store_id: uuid.UUID | None = None
    rate_type: RateType | None = None
    threshold_pp: Decimal | None = None
    period_days: int | None = None
    milestone_key: MilestoneKey | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    notify_in_app: bool | None = None
    notify_email: bool | None = None
    active: bool | None = None


class AlertRuleOutput(BaseModel):
    id: uuid.UUID
    name: str
    kind: AlertRuleKind
    scope: AlertRuleScope
    category: ProductCategory | None
    canonical_product_id: uuid.UUID | None
    product_name: str | None
    store_id: uuid.UUID | None
    store_name: str | None
    rate_type: RateType
    threshold_pp: Decimal
    period_days: int | None
    milestone_key: MilestoneKey | None
    starts_on: date | None
    ends_on: date | None
    notify_in_app: bool
    notify_email: bool
    active: bool
    phrase: str
    last_fired_at: datetime | None
    created_at: datetime


class PreviewItem(BaseModel):
    canonical_product_id: uuid.UUID | None
    product_name: str
    store_name: str
    variation_pct: Decimal


class RulePreviewOutput(BaseModel):
    devaluation_pct: Decimal | None = Field(description="null without rates for the period.")
    products_count: int
    stores_count: int
    evaluated: bool = Field(description="false for a milestone outside its date range.")
    items: list[PreviewItem] = Field(description="Top 10, highest variation first.")


class OptionStore(BaseModel):
    id: uuid.UUID
    slug: str
    name: str


class Milestone(BaseModel):
    key: MilestoneKey
    label: str
    starts_on: date
    ends_on: date


class RuleOptionsOutput(BaseModel):
    stores: list[OptionStore]
    categories: list[ProductCategory]
    milestones: list[Milestone] = Field(description="Next dates of each commercial milestone.")
    max_rules: int


class FiredAlertOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_id: uuid.UUID
    rule_name: str
    fired_at: datetime
    scope_label: str
    phrase: str
    products_count: int
    devaluation_pct: Decimal
    average_pct: Decimal
    seen: bool


class FiredAlertItemOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    canonical_product_id: uuid.UUID | None
    product_name: str
    category: ProductCategory | None
    store_name: str
    price_start: Decimal
    price_end: Decimal
    variation_pct: Decimal


class FiredAlertDetailOutput(FiredAlertOutput):
    items: list[FiredAlertItemOutput]


class AlertsSummaryOutput(BaseModel):
    unseen: int
    total: int
    active_rules: int
    rules: int
    affected_products: int = Field(description="Products in the alerts of the last 30 days.")
    max_gap_pp: Decimal | None = Field(
        description="Largest average − devaluation in the last 30 days."
    )
