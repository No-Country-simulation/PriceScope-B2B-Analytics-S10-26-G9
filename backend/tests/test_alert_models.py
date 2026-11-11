import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models import AlertRule, AlertRuleKind, AlertRuleScope, FiredAlert, MilestoneKey, RateType
from tests.conftest import create_active_user


def rule_data(user_id: uuid.UUID, **overrides: object) -> dict:
    base = {
        "user_id": user_id,
        "name": "Almacén supera al blue",
        "kind": AlertRuleKind.DEVALUATION,
        "scope": AlertRuleScope.CATEGORY,
        "category": "Almacén",
        "rate_type": RateType.BLUE,
        "threshold_pp": Decimal("2"),
        "period_days": 30,
    }
    return base | overrides


INVALID_RULES = [
    {"category": None},  # category scope needs a category
    {"period_days": None},  # devaluation needs a period
    {"period_days": 15},  # only 7, 30 or 90
    {"threshold_pp": Decimal("-1")},
    {
        "kind": AlertRuleKind.MILESTONE,
        "period_days": None,
        "milestone_key": MilestoneKey.CYBERWEEK,
        "starts_on": date(2026, 11, 9),
        "ends_on": date(2026, 11, 3),
    },  # reversed range
]


async def test_valid_rule_is_saved() -> None:
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        db.add(AlertRule(**rule_data(user.id)))
        await db.commit()


@pytest.mark.parametrize("overrides", INVALID_RULES)
async def test_database_rejects_inconsistent_rules(overrides: dict) -> None:
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        db.add(AlertRule(**rule_data(user.id, **overrides)))
        with pytest.raises(IntegrityError):
            await db.commit()


async def test_one_fired_alert_per_rule_per_day() -> None:
    user = await create_active_user("cliente@example.com")
    async with SessionLocal() as db:
        rule = AlertRule(**rule_data(user.id))
        db.add(rule)
        await db.flush()

        def fired() -> FiredAlert:
            return FiredAlert(
                rule_id=rule.id,
                user_id=user.id,
                evaluated_on=date(2026, 11, 9),
                rule_name="Regla",
                scope_label="Almacén · todas las tiendas · 30 días",
                phrase="Productos de Almacén subieron más de 2 p.p.",
                devaluation_pct=Decimal("4.10"),
                average_pct=Decimal("8.70"),
                products_count=1,
            )

        db.add(fired())
        await db.flush()
        db.add(fired())
        with pytest.raises(IntegrityError):
            await db.flush()
