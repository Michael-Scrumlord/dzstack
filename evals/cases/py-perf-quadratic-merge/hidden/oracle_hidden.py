"""Reference implementations and data for the hidden checks.

`merge_original` is the code as it was before any optimization (the behavior to keep).
`merge_reference` is a plain linear version of the same rules, used where the original is too slow.
"""
import random


def normalize_id(value):
    return str(value).strip().casefold()


def _stamp(record):
    return record.get("updated_at") or ""


def _combine(kept, newer):
    if _stamp(newer) >= _stamp(kept):
        winner, other = newer, kept
    else:
        winner, other = kept, newer
    combined = dict(winner)
    for field, value in other.items():
        if combined.get(field) is None and value is not None:
            combined[field] = value
    return combined


def _find(records, record_id):
    for i, record in enumerate(records):
        if normalize_id(record["id"]) == normalize_id(record_id):
            return i
    return -1


def merge_original(base, incoming):
    merged = []
    for record in [*base, *incoming]:
        i = _find(merged, record["id"])
        if i < 0:
            merged.append(dict(record))
        else:
            merged[i] = _combine(merged[i], record)
    return merged


def merge_reference(base, incoming):
    merged = {}
    for record in [*base, *incoming]:
        key = normalize_id(record["id"])
        kept = merged.get(key)
        merged[key] = dict(record) if kept is None else _combine(kept, record)
    return list(merged.values())


def big_dataset(seed=20260302, scale=1.0):
    """About 200,000 records: 120,000 in base, 80,000 incoming, about 170,000 distinct ids.

    `scale` shrinks every count proportionally (for measuring how a slow version grows).
    """
    rng = random.Random(seed)
    k = lambda n: int(n * scale)  # noqa: E731
    ids = list(range(k(170_000)))
    rng.shuffle(ids)
    old, new = ids[:k(114_000)], ids[k(114_000):]
    base_ids = old + [rng.choice(old) for _ in range(k(6_000))]
    incoming_ids = rng.sample(old, k(20_000)) + new + [rng.choice(new) for _ in range(k(4_000))]
    rng.shuffle(base_ids)
    rng.shuffle(incoming_ids)

    def written(k):
        text = f"C-{k:06d}"
        roll = rng.random()
        return text if roll < 0.9 else text.lower() if roll < 0.95 else f"  {text} "

    def record(k):
        stamp = None if rng.random() < 0.03 else f"2026-02-{rng.randint(1, 28):02d}T{rng.randint(0, 23):02d}:00:00Z"
        return {
            "id": written(k),
            "updated_at": stamp,
            "name": rng.choice([None, f"Customer {rng.randrange(10**6)}"]),
            "email": rng.choice([None, f"user{rng.randrange(10**6)}@example.com"]),
            "plan": rng.choice(["free", "pro", "team", None]),
            "seats": rng.choice([None, 1, 5, 25]),
        }

    return [record(k) for k in base_ids], [record(k) for k in incoming_ids]
