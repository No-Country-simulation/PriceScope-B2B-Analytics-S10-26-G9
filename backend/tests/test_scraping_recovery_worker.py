from unittest.mock import AsyncMock

import pytest

from app.workers import tasks


async def test_worker_recovery_calls_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The ARQ task delegates recovery to the existing service."""

    fake_recovery = AsyncMock(return_value=2)

    monkeypatch.setattr(
        tasks,
        "recover_stale_scraping_runs",
        fake_recovery,
    )

    recovered = await tasks.recover_scraping_runs({})

    assert recovered == 2
    fake_recovery.assert_awaited_once_with()


def test_recovery_is_registered_as_cron() -> None:
    """Verify the recovery task is scheduled."""

    registered_jobs = {job.name for job in tasks.WorkerSettings.cron_jobs}

    assert "cron:recover_scraping_runs" in registered_jobs
