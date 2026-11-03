"""The scheduler: runs the jobs that are due when tick() is called."""
from __future__ import annotations

import itertools
from datetime import datetime
from typing import Any, Callable

from schedkit.backoff import Backoff
from schedkit.clock import Clock, SystemClock
from schedkit.errors import JobError
from schedkit.jobs import Job, RunRecord
from schedkit.rules import Rule, parse_rule
from schedkit.store import JobStore


class Scheduler:
    def __init__(self, clock: Clock | None = None, backoff: Backoff | None = None):
        self.clock: Clock = clock or SystemClock()
        self.backoff = backoff or Backoff()
        self.store = JobStore()
        self._anonymous = itertools.count(1)

    def add(self, rule: Rule | str, func: Callable[[], Any], *, name: str | None = None, tags: tuple[str, ...] = ()) -> Job:
        """Registers a job. `rule` is a Rule or a rule string. Without a name the job is called job-1, job-2, ..."""
        parsed = parse_rule(rule) if isinstance(rule, str) else rule
        job = Job(name or f"job-{next(self._anonymous)}", parsed, func, tuple(tags))
        job.next_run = parsed.next_after(self.clock.now())
        return self.store.add(job)

    def remove(self, name: str) -> Job:
        return self.store.remove(name)

    def pause(self, name: str) -> None:
        self.store.get(name).paused = True

    def resume(self, name: str) -> None:
        """Resuming does not make up for runs missed while paused: the next run is the next one after now."""
        job = self.store.get(name)
        if not job.paused:
            raise JobError(f"job {name!r} is not paused")
        job.paused = False
        job.next_run = job.rule.next_after(self.clock.now())

    def next_due(self) -> datetime | None:
        return self.store.next_run()

    def tick(self) -> list[RunRecord]:
        """Runs every due job once, oldest due time first, and schedules each one's next run."""
        now = self.clock.now()
        records = []
        for job in sorted(self.store.due(now), key=lambda j: (j.next_run, j.name)):
            records.append(self._run(job, now))
        return records

    def _run(self, job: Job, now: datetime) -> RunRecord:
        job.last_run = now
        job.runs += 1
        try:
            result = job.func()
        except Exception as exc:  # a job may fail in any way; the scheduler keeps going
            job.failures += 1
            record = RunRecord(job.name, now, False, f"{type(exc).__name__}: {exc}")
            regular = job.rule.next_after(now)
            job.next_run = min(now + self.backoff.delay(job.failures), regular)
        else:
            job.failures = 0
            record = RunRecord(job.name, now, True, None, result)
            job.next_run = job.rule.next_after(now)
        self.store.history.append(record)
        return record
