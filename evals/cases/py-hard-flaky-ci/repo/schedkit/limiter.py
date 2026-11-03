from __future__ import annotations

from schedkit.clock import Clock


class TokenBucket:
    """Allows `rate` calls per second on average, with bursts of up to `burst`."""

    def __init__(self, rate: float, burst: int, clock: Clock):
        if rate <= 0 or burst < 1:
            raise ValueError("rate must be positive and burst at least 1")
        self.rate = rate
        self.burst = burst
        self.clock = clock
        self._tokens = float(burst)
        self._stamp = clock.now()

    def _refill(self) -> None:
        now = self.clock.now()
        elapsed = (now - self._stamp).total_seconds()
        if elapsed > 0:
            self._tokens = min(float(self.burst), self._tokens + elapsed * self.rate)
        self._stamp = now

    def allow(self, cost: float = 1.0) -> bool:
        self._refill()
        if self._tokens >= cost:
            self._tokens -= cost
            return True
        return False

    def wait_seconds(self, cost: float = 1.0) -> float:
        """How long until `cost` tokens are available (0 when they are now)."""
        self._refill()
        missing = cost - self._tokens
        return 0.0 if missing <= 0 else missing / self.rate
