# recsync

Merges two exports of the customer table (the existing one and a new one) into a single export. It runs every night from cron on the full tables, which hold about 200,000 records between them.

```
python3 -m recsync base.jsonl incoming.jsonl -o merged.jsonl
```

Python 3.11, standard library only. Tests: `python3 -m pytest -q`.

## Records

Each line of an export is a JSON object. `id` is required. `updated_at` is an ISO 8601 UTC timestamp such as `2026-03-01T10:00:00Z` (compared as text), and may be missing or null. Other fields (`name`, `email`, `plan`, ...) are passed through.

## Merge rules

`from recsync import merge_records` gives `merge_records(base, incoming)`, which takes any two iterables of dicts and returns a list with one record per customer. These rules are the contract, and the nightly output must not change:

- **Ids** match as text, ignoring surrounding whitespace and letter case: `42`, `"42"` and `" 42 "` are one customer, and so are `"C-7"` and `"c-7"`.
- **Processing order.** Every record of `base`, in order, then every record of `incoming`, in order.
- **Combining.** The first record seen for an id is kept (as a copy). Each later record with the same id, whether it comes from the same list or the other one, is combined with the record kept so far:
  - the record with the later `updated_at` wins; a missing or null `updated_at` is older than any timestamp;
  - on a tie the record processed later wins (so `incoming` wins over `base`, and a later line wins over an earlier one);
  - the winner's fields are used as they are, except that a field which is missing or null in the winner is taken from the other record if that has a value;
  - the combined record carries the winner's `id` as written.
- **Output order.** Records are in the order in which their ids were first seen in the processing order: the `base` ids first (in `base` order), then the ids that only occur in `incoming` (in `incoming` order). Combining never moves a record.
- Inputs are not modified, and the returned records are new dicts.
- A record without an `id` raises `KeyError`.
