from __future__ import annotations

from datetime import timedelta

from schedkit.clock import Clock
from schedkit.store import JobStore


def prune_history(store: JobStore, clock: Clock, *, max_age: timedelta, keep_last: int = 0) -> int:
    """Drops run records older than `max_age`, always keeping the newest `keep_last`. Returns how many were dropped."""
    cutoff = clock.now() - max_age
    records = list(store.history)
    protected = len(records) - keep_last if keep_last else len(records)
    kept = [r for i, r in enumerate(records) if r.at >= cutoff or i >= protected]
    dropped = len(records) - len(kept)
    store.history.clear()
    store.history.extend(kept)
    return dropped
