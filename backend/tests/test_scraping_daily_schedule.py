"""Tests for daily scraping cron configuration."""

from datetime import UTC

import pytest

from app.core.config import settings
from app.workers import tasks


def test_daily_schedules_are_registered() -> None:
    jobs = {job.name: job for job in tasks.WorkerSettings.cron_jobs}

    assert "cron:scrape_carrefour" in jobs
    assert "cron:scrape_jumbo" in jobs

    carrefour = jobs["cron:scrape_carrefour"]
    jumbo = jobs["cron:scrape_jumbo"]

    assert (carrefour.hour, carrefour.minute) == (9, 0)
    assert (jumbo.hour, jumbo.minute) == (9, 30)

    for job in (carrefour, jumbo):
        assert job.second == 0
        assert job.run_at_startup is False
        assert job.unique is True
        assert job.max_tries == 3

    assert tasks.WorkerSettings.timezone == UTC


@pytest.mark.parametrize(
    "job",
    [
        tasks.scrape_carrefour,
        tasks.scrape_jumbo,
    ],
)
async def test_daily_jobs_respect_disabled_flag(
    monkeypatch: pytest.MonkeyPatch,
    job,
) -> None:
    monkeypatch.setattr(
        settings,
        "scraping_jobs_enabled",
        False,
    )

    result = await job({})

    assert result == {"status": "disabled"}
