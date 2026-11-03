"""Run jobs: one attempt per try, with retries and a per-attempt timeout."""
from __future__ import annotations

import logging
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from .config import Job

log = logging.getLogger("jobrunner")


@dataclass(frozen=True)
class JobResult:
    name: str
    status: str  # "ok", "failed", "timeout" or "skipped"
    attempts: int


def _attempt(job: Job, base_dir: Path) -> tuple[str, str, str]:
    """Run the command once. Returns (status, detail, output)."""
    try:
        proc = subprocess.run(
            job.command, shell=True, cwd=base_dir, timeout=job.timeout or None,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        return "timeout", f"timed out after {job.timeout:g}s", out
    if proc.returncode == 0:
        return "ok", "", proc.stdout
    return "failed", f"failed (exit status {proc.returncode})", proc.stdout


def _write_log(job: Job, base_dir: Path, attempt: int, output: str) -> None:
    if job.log_file is None:
        return
    path = base_dir / job.log_file
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(f"--- {job.name}, attempt {attempt} ---\n{output}")


def run_job(
    job: Job,
    *,
    base_dir: Path = Path("."),
    sleep: Callable[[float], None] = time.sleep,
    notify: Callable[[list[str], str], None] | None = None,
) -> JobResult:
    """Run `job`, retrying up to `job.retries` times. Tells `job.notify` if it gives up."""
    total = job.retries + 1
    limit = f"{job.timeout:g}s" if job.timeout else "none"
    log.info("%s: starting (retries=%d, timeout=%s)", job.name, job.retries, limit)
    status = "failed"
    for n in range(1, total + 1):
        status, detail, output = _attempt(job, base_dir)
        _write_log(job, base_dir, n, output)
        if status == "ok":
            log.info("%s: succeeded on attempt %d/%d", job.name, n, total)
            return JobResult(job.name, "ok", n)
        if n < total:
            log.warning("%s: attempt %d/%d %s, retrying in %gs", job.name, n, total, detail, job.retry_delay)
            sleep(job.retry_delay)
        else:
            log.warning("%s: attempt %d/%d %s", job.name, n, total, detail)
    log.error("%s: giving up after %d attempt%s", job.name, total, "" if total == 1 else "s")
    if notify is not None and job.notify:
        notify(job.notify, f"job {job.name} failed after {total} attempt{'' if total == 1 else 's'}")
    return JobResult(job.name, status, total)


def run_all(jobs: Iterable[Job], **kwargs) -> list[JobResult]:
    """Run every enabled job in order; disabled jobs are reported as skipped."""
    results = []
    for job in jobs:
        if not job.enabled:
            log.info("%s: disabled, skipping", job.name)
            results.append(JobResult(job.name, "skipped", 0))
        else:
            results.append(run_job(job, **kwargs))
    return results
