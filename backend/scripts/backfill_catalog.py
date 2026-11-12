"""Fills category and net content of existing canonical products. Safe to run more than once.

uv run python -m scripts.backfill_catalog
"""

import asyncio

from app.core.database import SessionLocal, engine
from app.services.catalog import fill_missing_catalog


async def main() -> None:
    async with SessionLocal() as db:
        changed = await fill_missing_catalog(db)
    await engine.dispose()
    print(f"Canonical products updated: {changed}")


if __name__ == "__main__":
    asyncio.run(main())
