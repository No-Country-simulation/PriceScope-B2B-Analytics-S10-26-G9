"""Queues the listings that have no canonical product yet. Safe to run more than once.

uv run python -m scripts.backfill_curation
"""

import asyncio

from app.core.database import SessionLocal, engine
from app.services.curation import queue_unmatched


async def main() -> None:
    async with SessionLocal() as db:
        queued = await queue_unmatched(db)
    await engine.dispose()
    print(f"Listings queued for curation: {queued}")


if __name__ == "__main__":
    asyncio.run(main())
