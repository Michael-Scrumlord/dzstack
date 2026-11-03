from schedkit.report import upcoming
from schedkit.scheduler import Scheduler
from tests.helpers import clock_at


def test_upcoming_lists_the_next_runs_in_local_time():
    sched = Scheduler(clock_at(2025, 3, 8, 12))
    sched.add("daily 09:00", lambda: None, name="report")
    sched.add("weekly mon,thu 17:30", lambda: None, name="digest")
    assert upcoming(sched, 4) == [
        "2025-03-09 09:00 Sun  report (every day at 09:00)",
        "2025-03-10 09:00 Mon  report (every day at 09:00)",
        "2025-03-10 17:30 Mon  digest (every mon, thu at 17:30)",
        "2025-03-11 09:00 Tue  report (every day at 09:00)",
    ]


def test_paused_jobs_are_left_out():
    sched = Scheduler(clock_at(2025, 3, 8, 12))
    sched.add("daily 09:00", lambda: None, name="a")
    sched.add("daily 10:00", lambda: None, name="b")
    sched.pause("a")
    assert [line.split("  ")[1].split(" ")[0] for line in upcoming(sched, 2)] == ["b", "b"]
