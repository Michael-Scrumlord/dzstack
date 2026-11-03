"""A text report of what is coming up."""
from __future__ import annotations

from datetime import datetime

from schedkit.scheduler import Scheduler
from schedkit.timeutil import to_local_naive


def upcoming(scheduler: Scheduler, count: int = 5) -> list[str]:
    """For each of the next `count` runs across all active jobs: the local time, the weekday, the job."""
    rows: list[tuple[datetime, str, str]] = []
    for job in scheduler.store:
        if job.paused or job.next_run is None:
            continue
        current = job.next_run
        for _ in range(count):
            rows.append((current, job.name, job.rule.describe()))
            current = job.rule.next_after(current)
    rows.sort(key=lambda r: (r[0], r[1]))
    lines = []
    for when, name, how in rows[:count]:
        wall = to_local_naive(when)
        lines.append(f"{wall:%Y-%m-%d %H:%M} {wall:%a}  {name} ({how})")
    return lines
