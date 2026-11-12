"""Shrinkflation: a listing now has less net content than it had before."""

import uuid
from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Price
from app.schemas.common import ShrinkflationOutput
from app.services.catalog import content_label

# How far back a change of content is still flagged.
SHRINKFLATION_DAYS = 90


async def shrinkflation_by_listing(
    db: AsyncSession, listing_ids: list[uuid.UUID], since: datetime
) -> dict[uuid.UUID, ShrinkflationOutput]:
    """Listings whose current net content is smaller than a previous one since `since`."""
    if not listing_ids:
        return {}
    rows = await db.execute(
        select(
            Price.listing_id,
            Price.grammage,
            Price.unit,
            func.min(Price.captured_at),
            func.max(Price.captured_at),
        )
        .where(
            Price.listing_id.in_(listing_ids),
            Price.location_id.is_(None),
            Price.captured_at >= since,
            Price.grammage.is_not(None),
        )
        .group_by(Price.listing_id, Price.grammage, Price.unit)
    )
    by_listing: dict[uuid.UUID, list[tuple[Decimal, str | None, datetime, datetime]]] = defaultdict(
        list
    )
    for listing_id, grammage, unit, first, last in rows:
        by_listing[listing_id].append((grammage, unit, first, last))

    result = {}
    for listing_id, groups in by_listing.items():
        current = max(groups, key=lambda g: g[3])
        previous = [
            g for g in groups if g[1] == current[1] and g[0] > current[0] and g[3] < current[2]
        ]
        if not previous:
            continue
        before = max(previous, key=lambda g: g[3])
        before_label = content_label(before[0], before[1])
        after_label = content_label(current[0], current[1])
        if before_label and after_label:
            result[listing_id] = ShrinkflationOutput(
                before=before_label, after=after_label, changed_at=current[2]
            )
    return result
