"""A smoke test at a size where even the straightforward implementation is quick."""
from recsync import merge_records


def test_a_few_thousand_records():
    base = [{"id": f"C-{i % 1500}", "updated_at": f"2026-01-{1 + i % 28:02d}T00:00:00Z", "n": i} for i in range(2000)]
    incoming = [{"id": f"c-{i % 1800}", "updated_at": f"2026-02-{1 + i % 28:02d}T00:00:00Z", "n": i} for i in range(2000)]
    out = merge_records(base, incoming)
    assert len(out) == 1800
    assert len({r["id"].casefold() for r in out}) == 1800
