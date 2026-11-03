from __future__ import annotations

from collections import deque
from datetime import datetime
from typing import Iterator

from schedkit.errors import JobError
from schedkit.jobs import Job, RunRecord

HISTORY_LIMIT = 500


class JobStore:
    """Jobs by name, in insertion order, and a bounded history of runs."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self.history: deque[RunRecord] = deque(maxlen=HISTORY_LIMIT)

    def add(self, job: Job) -> Job:
        if job.name in self._jobs:
            raise JobError(f"a job named {job.name!r} already exists")
        self._jobs[job.name] = job
        return job

    def get(self, name: str) -> Job:
        try:
            return self._jobs[name]
        except KeyError:
            raise JobError(f"no job named {name!r}") from None

    def remove(self, name: str) -> Job:
        job = self.get(name)
        del self._jobs[name]
        return job

    def all(self) -> list[Job]:
        return list(self._jobs.values())

    def __iter__(self) -> Iterator[Job]:
        return iter(self.all())

    def __len__(self) -> int:
        return len(self._jobs)

    def due(self, now: datetime) -> list[Job]:
        return [j for j in self._jobs.values() if not j.paused and j.next_run is not None and j.next_run <= now]

    def next_run(self) -> datetime | None:
        upcoming = [j.next_run for j in self._jobs.values() if not j.paused and j.next_run is not None]
        return min(upcoming) if upcoming else None

    def with_tag(self, tag: str) -> list[Job]:
        return [j for j in self._jobs.values() if tag in j.tags]
