"""A small in-process cache whose entries expire."""
import threading
import time


class TTLCache:
    def __init__(self, ttl_seconds, clock=time.monotonic):
        self._ttl = ttl_seconds
        self._clock = clock
        self._items = {}
        self._lock = threading.Lock()

    def get(self, key):
        """The cached value, or None if there is none or it has expired."""
        with self._lock:
            entry = self._items.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if self._clock() >= expires_at:
                del self._items[key]
                return None
            return value

    def set(self, key, value):
        with self._lock:
            self._items[key] = (self._clock() + self._ttl, value)

    def invalidate(self, key):
        with self._lock:
            self._items.pop(key, None)

    def clear(self):
        with self._lock:
            self._items.clear()
