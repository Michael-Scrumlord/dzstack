"""Daily time windows in local time, such as a maintenance window or quiet hours."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time

from schedkit.timeutil import ensure_aware, to_local_naive


@dataclass(frozen=True)
class Window:
    """From `start` (inclusive) to `end` (exclusive), every day. A window may cross midnight (22:00 to 06:00)."""

    start: time
    end: time

    def contains(self, moment: datetime) -> bool:
        wall = to_local_naive(ensure_aware(moment)).time()
        if self.start <= self.end:
            return self.start <= wall < self.end
        return wall >= self.start or wall < self.end
