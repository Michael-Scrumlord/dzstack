from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from schedkit.rules import Rule


@dataclass
class Job:
    name: str
    rule: Rule
    func: Callable[[], Any]
    tags: tuple[str, ...] = ()
    paused: bool = False
    next_run: datetime | None = None
    last_run: datetime | None = None
    failures: int = 0
    runs: int = 0


@dataclass(frozen=True)
class RunRecord:
    job: str
    at: datetime
    ok: bool
    error: str | None = None
    result: Any = field(default=None, compare=False)
