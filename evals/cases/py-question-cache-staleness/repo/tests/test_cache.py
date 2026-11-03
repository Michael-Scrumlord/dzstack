from catalog.cache import TTLCache


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_returns_what_was_set():
    cache = TTLCache(60)
    cache.set("a", 1)
    assert cache.get("a") == 1
    assert cache.get("b") is None


def test_entries_expire_after_the_ttl():
    clock = Clock()
    cache = TTLCache(60, clock=clock)
    cache.set("a", 1)
    clock.now = 59.9
    assert cache.get("a") == 1
    clock.now = 60.0
    assert cache.get("a") is None


def test_invalidate_and_clear():
    cache = TTLCache(60)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.invalidate("a")
    assert cache.get("a") is None and cache.get("b") == 2
    cache.clear()
    assert cache.get("b") is None
