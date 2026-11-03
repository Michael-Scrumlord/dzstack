from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta


@dataclass(frozen=True)
class Backoff:
    """How long a failing job waits before it is tried again: base * factor^(failures-1), at most `cap`."""

    base: timedelta = timedelta(seconds=30)
    factor: float = 2.0
    cap: timedelta = timedelta(hours=1)

    def delay(self, failures: int) -> timedelta:
        if failures < 1:
            return timedelta(0)
        seconds = self.base.total_seconds() * self.factor ** (failures - 1)
        return min(timedelta(seconds=seconds), self.cap)
