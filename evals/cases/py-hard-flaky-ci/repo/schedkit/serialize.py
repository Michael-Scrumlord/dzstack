"""Saving and restoring a scheduler's jobs as JSON (rules by their text, times in UTC)."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Callable, Mapping

from schedkit.errors import SchedkitError
from schedkit.jobs import Job
from schedkit.rules import parse_rule
from schedkit.scheduler import Scheduler
from schedkit.timeutil import UTC, utc_iso

FORMAT_VERSION = 1


def _when(moment: datetime | None) -> str | None:
    return None if moment is None else utc_iso(moment)


def _parse_when(text: str | None) -> datetime | None:
    return None if text is None else datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(UTC)


def dump_jobs(scheduler: Scheduler) -> str:
    jobs: list[dict[str, Any]] = []
    for job in scheduler.store:
        jobs.append(
            {
                "name": job.name,
                "rule": job.rule.text,
                "skipped": sorted(d.isoformat() for d in job.rule.skipped),
                "tags": list(job.tags),
                "paused": job.paused,
                "next_run": _when(job.next_run),
                "last_run": _when(job.last_run),
                "failures": job.failures,
                "runs": job.runs,
            }
        )
    return json.dumps({"version": FORMAT_VERSION, "jobs": jobs}, indent=2)


def load_jobs(scheduler: Scheduler, text: str, functions: Mapping[str, Callable[[], Any]]) -> list[Job]:
    """Adds the saved jobs to `scheduler`. `functions` maps job names to what they run."""
    from datetime import date

    data = json.loads(text)
    if data.get("version") != FORMAT_VERSION:
        raise SchedkitError(f"cannot read job file version {data.get('version')!r}")
    restored = []
    for item in data["jobs"]:
        if item["name"] not in functions:
            raise SchedkitError(f"no function given for job {item['name']!r}")
        rule = parse_rule(item["rule"])
        for day in item.get("skipped", []):
            rule.skip(date.fromisoformat(day))
        job = scheduler.add(rule, functions[item["name"]], name=item["name"], tags=tuple(item.get("tags", ())))
        job.paused = bool(item.get("paused"))
        job.next_run = _parse_when(item.get("next_run")) or job.next_run
        job.last_run = _parse_when(item.get("last_run"))
        job.failures = int(item.get("failures", 0))
        job.runs = int(item.get("runs", 0))
        restored.append(job)
    return restored
