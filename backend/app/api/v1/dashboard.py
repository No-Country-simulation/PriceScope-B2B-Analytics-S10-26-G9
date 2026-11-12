from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import ProductCategory
from app.schemas.dashboard import MAX_DASHBOARD_DAYS, DashboardOptions, DashboardOutput
from app.schemas.products import Rate
from app.services import dashboard
from app.services.products import today_in_argentina

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    responses={401: {"description": "Not authenticated"}},
)


def _split(value: str | None) -> list[str] | None:
    if value is None:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


@router.get("", response_model=DashboardOutput, summary="Price index by category vs. the dollar")
async def get_dashboard(
    db: DbSession,
    user: CurrentUser,
    start: date | None = None,
    end: date | None = None,
    stores: Annotated[
        str | None, Query(description="Comma-separated store slugs. All visible by default.")
    ] = None,
    categories: Annotated[
        str | None, Query(description="Comma-separated categories. All by default.")
    ] = None,
    rate: Rate = "blue",
) -> DashboardOutput:
    end = end or today_in_argentina()
    start = start or end - timedelta(days=180)
    if start >= end:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "start debe ser anterior a end")
    if (end - start).days > MAX_DASHBOARD_DAYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"El rango no puede superar {MAX_DASHBOARD_DAYS} días",
        )
    try:
        selected = [ProductCategory(c) for c in _split(categories) or []]
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Categoría desconocida"
        ) from None
    return await dashboard.get_dashboard(
        db,
        user,
        start=start,
        end=end,
        stores=_split(stores),
        categories=selected or None,
        rate=rate,
    )


@router.get("/options", response_model=DashboardOptions, summary="Filters for the dashboard")
async def options(db: DbSession, user: CurrentUser) -> DashboardOptions:
    return await dashboard.dashboard_options(db, user)
