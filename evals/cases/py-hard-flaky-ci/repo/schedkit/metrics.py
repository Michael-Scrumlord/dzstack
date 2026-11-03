from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from schedkit.jobs import RunRecord


@dataclass
class JobStats:
    runs: int = 0
    failures: int = 0
    last_error: str | None = None


@dataclass
class Metrics:
    """Counts runs and failures per job from a stream of run records."""

    per_job: dict[str, JobStats] = field(default_factory=lambda: defaultdict(JobStats))

    def observe(self, record: RunRecord) -> None:
        stats = self.per_job[record.job]
        stats.runs += 1
        if not record.ok:
            stats.failures += 1
            stats.last_error = record.error

    def observe_all(self, records: list[RunRecord]) -> None:
        for record in records:
            self.observe(record)

    def failure_rate(self, job: str) -> float:
        stats = self.per_job.get(job)
        return 0.0 if not stats or not stats.runs else stats.failures / stats.runs

    def summary(self) -> str:
        lines = [f"{name}: {s.runs} runs, {s.failures} failed" for name, s in sorted(self.per_job.items())]
        return "\n".join(lines) or "(no runs)"
