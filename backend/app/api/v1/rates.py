from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import RateType
from app.schemas.rates import LatestRatesOutput, QuoteOutput, RateHistoryPoint
from app.services import rates

router = APIRouter(
    prefix="/rates",
    tags=["rates"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/latest", response_model=LatestRatesOutput, summary="Latest official and blue rates")
async def latest(db: DbSession, _user: CurrentUser) -> LatestRatesOutput:
    by_type = {rate.type: rate for rate in await rates.latest_rates(db)}
    official = by_type.get(RateType.OFFICIAL)
    blue = by_type.get(RateType.BLUE)
    return LatestRatesOutput(
        official=QuoteOutput.model_validate(official) if official else None,
        blue=QuoteOutput.model_validate(blue) if blue else None,
        gap_pct=rates.gap_pct(official.sell if official else None, blue.sell if blue else None),
    )


@router.get(
    "/history",
    response_model=list[RateHistoryPoint],
    summary="Last rate of each day",
    responses={422: {"description": "Invalid range"}},
)
async def history(
    db: DbSession,
    _user: CurrentUser,
    rate_type: Annotated[RateType, Query(alias="type")] = RateType.BLUE,
    start: date | None = None,
    end: date | None = None,
) -> list[RateHistoryPoint]:
    end = end or datetime.now(ZoneInfo(rates.BUSINESS_TIME_ZONE)).date()
    start = start or end - timedelta(days=30)
    if start > end:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "start debe ser anterior a end")
    if (end - start).days > rates.MAX_HISTORY_DAYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"El rango no puede superar {rates.MAX_HISTORY_DAYS} días",
        )
    points = await rates.rate_history(db, rate_type, start, end)
    return [RateHistoryPoint(date=day, sell=sell) for day, sell in points]
