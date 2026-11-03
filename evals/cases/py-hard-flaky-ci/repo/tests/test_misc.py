from datetime import time, timedelta

import pytest

from schedkit.backoff import Backoff
from schedkit.clock import ManualClock
from schedkit.jobs import RunRecord
from schedkit.limiter import TokenBucket
from schedkit.metrics import Metrics
from schedkit.naming import is_valid_job_name, slugify
from schedkit.retention import prune_history
from schedkit.scheduler import Scheduler
from schedkit.windows import Window
from tests.helpers import at, clock_at, utc


def test_backoff_grows_and_is_capped():
    b = Backoff(base=timedelta(seconds=30), factor=2, cap=timedelta(minutes=5))
    assert [b.delay(n).total_seconds() for n in (0, 1, 2, 3, 4, 5, 9)] == [0, 30, 60, 120, 240, 300, 300]


def test_token_bucket():
    clock = ManualClock(utc(2025, 1, 1))
    bucket = TokenBucket(rate=2, burst=3, clock=clock)
    assert [bucket.allow() for _ in range(4)] == [True, True, True, False]
    assert bucket.wait_seconds() == pytest.approx(0.5)
    clock.advance(timedelta(seconds=1))
    assert bucket.allow() and bucket.allow() and not bucket.allow()
    clock.advance(timedelta(hours=1))
    assert [bucket.allow() for _ in range(4)] == [True, True, True, False]  # refills only up to the burst
    with pytest.raises(ValueError):
        TokenBucket(rate=0, burst=1, clock=clock)


def test_windows_may_cross_midnight():
    quiet = Window(time(22, 0), time(6, 0))
    assert quiet.contains(at(2025, 1, 15, 23, 30)) and quiet.contains(at(2025, 1, 15, 5, 59))
    assert not quiet.contains(at(2025, 1, 15, 6, 0)) and not quiet.contains(at(2025, 1, 15, 12, 0))
    day = Window(time(9, 0), time(17, 0))
    assert day.contains(at(2025, 1, 15, 9, 0)) and not day.contains(at(2025, 1, 15, 17, 0))


def test_metrics_count_runs_and_failures():
    m = Metrics()
    m.observe_all([RunRecord("a", utc(2025, 1, 1), True), RunRecord("a", utc(2025, 1, 2), False, "boom"), RunRecord("b", utc(2025, 1, 1), True)])
    assert m.failure_rate("a") == 0.5 and m.failure_rate("b") == 0 and m.failure_rate("zzz") == 0
    assert m.summary() == "a: 2 runs, 1 failed\nb: 1 runs, 0 failed"
    assert Metrics().summary() == "(no runs)"


def test_history_is_pruned_by_age_but_the_newest_are_kept():
    clock = ManualClock(utc(2025, 2, 1))
    sched = Scheduler(clock)
    for day in range(1, 11):
        sched.store.history.append(RunRecord("j", utc(2025, 1, day), True))
    assert prune_history(sched.store, clock, max_age=timedelta(days=25)) == 6  # Jan 1..6 are older than 25 days
    assert [r.at.day for r in sched.store.history] == [7, 8, 9, 10]
    sched.store.history.clear()
    for day in range(1, 11):
        sched.store.history.append(RunRecord("j", utc(2025, 1, day), True))
    assert prune_history(sched.store, clock, max_age=timedelta(days=25), keep_last=6) == 4  # Jan 5..10 are always kept
    assert [r.at.day for r in sched.store.history] == [5, 6, 7, 8, 9, 10]


def test_job_names():
    assert is_valid_job_name("nightly-export.v2") and not is_valid_job_name("Nightly") and not is_valid_job_name("-x")
    assert slugify("Nightly Export (EU)") == "nightly-export-eu"
    assert slugify("???") == "job"
