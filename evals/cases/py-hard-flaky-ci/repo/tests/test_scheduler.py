from datetime import date, timedelta

import pytest

from schedkit.backoff import Backoff
from schedkit.errors import JobError
from schedkit.rules import parse_rule
from schedkit.scheduler import Scheduler
from schedkit.timeutil import to_local_naive
from tests.helpers import TRANSITION_DAYS, at, clock_at, utc


def test_jobs_get_names_and_a_first_run():
    sched = Scheduler(clock_at(2025, 3, 10, 8))
    first = sched.add("daily 09:00", lambda: None)
    second = sched.add("daily 09:00", lambda: None, name="nightly")
    assert (first.name, second.name) == ("job-1", "nightly")
    assert first.next_run == at(2025, 3, 10, 9)
    with pytest.raises(JobError, match="already exists"):
        sched.add("daily 09:00", lambda: None, name="nightly")


def test_ids_start_at_one_for_every_scheduler():
    assert Scheduler(clock_at(2025, 3, 10)).add("daily 09:00", lambda: None).name == "job-1"
    assert Scheduler(clock_at(2025, 3, 10)).add("daily 09:00", lambda: None).name == "job-1"


def test_tick_runs_due_jobs_once_and_schedules_the_next():
    clock = clock_at(2025, 3, 10, 8)
    sched = Scheduler(clock)
    calls = []
    job = sched.add("daily 09:00", lambda: calls.append(clock.now()) or "done")
    assert sched.tick() == []
    clock.set(at(2025, 3, 10, 9, 0))
    (record,) = sched.tick()
    assert (record.job, record.ok, record.result) == (job.name, True, "done")
    assert sched.tick() == []  # the same moment again: nothing is due
    assert job.next_run == at(2025, 3, 11, 9)
    assert (job.runs, job.failures) == (1, 0)


def test_due_jobs_run_oldest_first_then_by_name():
    clock = clock_at(2025, 3, 10, 6)
    sched = Scheduler(clock)
    order = []
    sched.add("daily 07:00", lambda: order.append("b"), name="b")
    sched.add("daily 06:30", lambda: order.append("z"), name="z")
    sched.add("daily 07:00", lambda: order.append("a"), name="a")
    clock.set(at(2025, 3, 10, 8))
    sched.tick()
    assert order == ["z", "a", "b"]


def test_a_failing_job_backs_off_but_not_past_its_next_regular_run():
    clock = clock_at(2025, 3, 10, 8, 59)
    sched = Scheduler(clock, Backoff(base=timedelta(minutes=10), factor=2, cap=timedelta(hours=1)))

    def boom():
        raise RuntimeError("down")

    job = sched.add("daily 09:00", boom)
    clock.set(at(2025, 3, 10, 9))
    (record,) = sched.tick()
    assert not record.ok and record.error == "RuntimeError: down"
    assert job.next_run == at(2025, 3, 10, 9, 10)
    clock.set(job.next_run)
    sched.tick()
    assert job.failures == 2 and job.next_run == at(2025, 3, 10, 9, 30)


def test_success_resets_the_failures():
    clock = clock_at(2025, 3, 10, 8, 59)
    sched = Scheduler(clock)
    outcomes = iter([False, True])

    def flaky():
        if not next(outcomes):
            raise RuntimeError("no")

    job = sched.add("daily 09:00", flaky)
    clock.set(at(2025, 3, 10, 9))
    sched.tick()
    assert job.failures == 1
    clock.set(job.next_run)
    sched.tick()
    assert job.failures == 0


def test_pause_resume_and_remove():
    clock = clock_at(2025, 3, 10, 8)
    sched = Scheduler(clock)
    job = sched.add("daily 09:00", lambda: None, name="j")
    sched.pause("j")
    clock.set(at(2025, 3, 10, 10))
    assert sched.tick() == [] and sched.next_due() is None
    sched.resume("j")
    assert not job.paused and job.next_run == at(2025, 3, 11, 9)
    with pytest.raises(JobError, match="not paused"):
        sched.resume("j")
    sched.remove("j")
    with pytest.raises(JobError, match="no job named"):
        sched.remove("j")


def test_tags_and_next_due():
    sched = Scheduler(clock_at(2025, 3, 10, 8))
    sched.add("daily 09:00", lambda: None, name="a", tags=("nightly",))
    sched.add("daily 08:30", lambda: None, name="b", tags=("nightly", "eu"))
    assert [j.name for j in sched.store.with_tag("nightly")] == ["a", "b"]
    assert [j.name for j in sched.store.with_tag("eu")] == ["b"]
    assert sched.next_due() == at(2025, 3, 10, 8, 30)


def test_a_daily_job_over_a_week_runs_seven_times():
    clock = clock_at(2025, 3, 8, 0, 5)
    sched = Scheduler(clock)
    runs = []
    sched.add("daily 09:00", lambda: runs.append(clock.now()))
    for _ in range(7 * 24):
        clock.advance(timedelta(hours=1))
        sched.tick()
    assert [to_local_naive(r).date() for r in runs] == [date(2025, 3, 8) + timedelta(days=i) for i in range(7)]


@pytest.mark.parametrize("day", TRANSITION_DAYS, ids=str)
def test_a_daily_job_runs_at_its_time_every_day_through_a_clock_change(day):
    for hour, minute in [(1, 30), (2, 30)]:
        before = day - timedelta(days=2)
        clock = clock_at(before.year, before.month, before.day, 12)
        sched = Scheduler(clock)
        runs = []
        sched.add(f"daily {hour:02d}:{minute:02d}", lambda: runs.append(clock.now()))
        for _ in range(5 * 24 * 4):
            clock.advance(timedelta(minutes=15))
            sched.tick()
        dates = [day + timedelta(days=o) for o in range(-1, 4)]
        expected = [at(d.year, d.month, d.day, hour, minute) for d in dates]
        # a run is picked up by the first tick at or after it, so compare to the quarter hour that follows
        assert len(runs) == len(expected), f"{day} {hour}:{minute}: {len(runs)} runs"
        for run, want in zip(runs, expected):
            assert want <= run < want + timedelta(minutes=15), f"{day} {hour}:{minute}: ran at {run}, due {want}"


def test_a_job_can_skip_a_date():
    clock = clock_at(2025, 3, 10, 6)
    sched = Scheduler(clock)
    job = sched.add("weekly mon-fri 09:15", lambda: None)
    job.rule.skip(date(2025, 3, 10))
    job.next_run = job.rule.next_after(clock.now())
    assert job.next_run == at(2025, 3, 11, 9, 15)
