import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.alerts import (
    AlertRuleInput,
    AlertRuleOutput,
    AlertRulePatch,
    AlertsSummaryOutput,
    FiredAlertDetailOutput,
    FiredAlertOutput,
    RuleConditions,
    RuleOptionsOutput,
    RulePreviewOutput,
)
from app.schemas.common import Page
from app.services import alerts

UNAUTHENTICATED = {401: {"description": "Not authenticated"}}
NOT_OWN_RULE = {404: {"description": "The rule does not exist or belongs to another user"}}
NOT_OWN_ALERT = {404: {"description": "The alert does not exist or belongs to another user"}}
INVALID_RULE = {
    400: {"description": "Store or product outside the user's stores, or rule limit"},
    422: {"description": "Invalid combination of fields"},
}

rules_router = APIRouter(prefix="/alert-rules", tags=["alerts"], responses=UNAUTHENTICATED)
alerts_router = APIRouter(prefix="/alerts", tags=["alerts"], responses=UNAUTHENTICATED)


@rules_router.get("", response_model=list[AlertRuleOutput], summary="My alert rules")
async def list_rules(db: DbSession, user: CurrentUser) -> list[AlertRuleOutput]:
    return await alerts.list_rules(db, user)


@rules_router.get("/options", response_model=RuleOptionsOutput, summary="Options for the form")
async def options(db: DbSession, user: CurrentUser) -> RuleOptionsOutput:
    return await alerts.rule_options(db, user)


@rules_router.post(
    "/preview",
    response_model=RulePreviewOutput,
    summary="What the rule would fire with today's data",
    responses=INVALID_RULE,
)
async def preview(db: DbSession, user: CurrentUser, data: RuleConditions) -> RulePreviewOutput:
    return await alerts.preview_rule(db, user, data)


@rules_router.post(
    "",
    response_model=AlertRuleOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a rule",
    responses=INVALID_RULE,
)
async def create_rule(db: DbSession, user: CurrentUser, data: AlertRuleInput) -> AlertRuleOutput:
    return await alerts.create_rule(db, user, data)


@rules_router.get(
    "/{rule_id}", response_model=AlertRuleOutput, summary="One rule", responses=NOT_OWN_RULE
)
async def get_rule(db: DbSession, user: CurrentUser, rule_id: uuid.UUID) -> AlertRuleOutput:
    return await alerts.get_rule(db, user, rule_id)


@rules_router.patch(
    "/{rule_id}",
    response_model=AlertRuleOutput,
    summary="Edit, pause or resume a rule",
    responses=NOT_OWN_RULE | INVALID_RULE,
)
async def update_rule(
    db: DbSession, user: CurrentUser, rule_id: uuid.UUID, data: AlertRulePatch
) -> AlertRuleOutput:
    return await alerts.update_rule(db, user, rule_id, data)


@rules_router.delete(
    "/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a rule and its alerts",
    responses=NOT_OWN_RULE,
)
async def delete_rule(db: DbSession, user: CurrentUser, rule_id: uuid.UUID) -> Response:
    await alerts.delete_rule(db, user, rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@alerts_router.get("", response_model=Page[FiredAlertOutput], summary="Fired alerts inbox")
async def list_alerts(
    db: DbSession,
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    unseen: Annotated[bool, Query(description="Only the ones not seen yet.")] = False,
) -> Page[FiredAlertOutput]:
    return await alerts.list_alerts(db, user, page=page, size=size, unseen=unseen)


@alerts_router.get(
    "/summary", response_model=AlertsSummaryOutput, summary="Screen KPIs and bell count"
)
async def summary(db: DbSession, user: CurrentUser) -> AlertsSummaryOutput:
    return await alerts.alerts_summary(db, user)


@alerts_router.post(
    "/seen", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all alerts as seen"
)
async def mark_all_seen(db: DbSession, user: CurrentUser) -> Response:
    await alerts.mark_seen(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@alerts_router.get(
    "/{alert_id}",
    response_model=FiredAlertDetailOutput,
    summary="Alert with the products that fired it",
    responses=NOT_OWN_ALERT,
)
async def get_alert(
    db: DbSession, user: CurrentUser, alert_id: uuid.UUID
) -> FiredAlertDetailOutput:
    return await alerts.get_alert(db, user, alert_id)


@alerts_router.post(
    "/{alert_id}/seen",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark one alert as seen",
    responses=NOT_OWN_ALERT,
)
async def mark_seen(db: DbSession, user: CurrentUser, alert_id: uuid.UUID) -> Response:
    await alerts.mark_seen(db, user, alert_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
