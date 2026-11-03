import json
from datetime import date

import pytest

from schedkit.errors import SchedkitError
from schedkit.rules import parse_rule
from schedkit.scheduler import Scheduler
from schedkit.serialize import dump_jobs, load_jobs
from tests.helpers import at, clock_at


def test_jobs_survive_a_round_trip():
    sched = Scheduler(clock_at(2025, 1, 15, 8))
    sched.add("weekly mon-fri 09:00", lambda: "x", name="digest", tags=("mail",))
    sched.pause("digest")
    text = dump_jobs(sched)
    assert json.loads(text)["jobs"][0]["rule"] == "weekly mon-fri 09:00"

    again = Scheduler(clock_at(2025, 1, 15, 8))
    (job,) = load_jobs(again, text, {"digest": lambda: "x"})
    assert (job.name, job.tags, job.paused) == ("digest", ("mail",), True)
    assert job.rule.weekdays == (0, 1, 2, 3, 4)


def test_skipped_dates_are_saved_and_restored():
    sched = Scheduler(clock_at(2025, 3, 7, 8))
    job = sched.add("daily 09:00", lambda: None, name="report")
    job.rule.skip(date(2025, 3, 10))
    text = dump_jobs(sched)
    assert json.loads(text)["jobs"][0]["skipped"] == ["2025-03-10"]

    again = Scheduler(clock_at(2025, 3, 7, 8))
    (restored,) = load_jobs(again, text, {"report": lambda: None})
    assert date(2025, 3, 10) in restored.rule.skipped
    assert restored.rule.next_after(at(2025, 3, 9, 10)) == at(2025, 3, 11, 9)


def test_unknown_versions_and_missing_functions_are_refused():
    sched = Scheduler(clock_at(2025, 1, 15, 8))
    with pytest.raises(SchedkitError, match="version 7"):
        load_jobs(sched, json.dumps({"version": 7, "jobs": []}), {})
    text = json.dumps({"version": 1, "jobs": [{"name": "x", "rule": "daily 09:00"}]})
    with pytest.raises(SchedkitError, match="no function given for job 'x'"):
        load_jobs(sched, text, {})
