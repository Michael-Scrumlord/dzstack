"""Merge two lists of customer records into one, one record per customer id."""
from __future__ import annotations

from typing import Iterable


def normalize_id(value) -> str:
    """Ids match as text, ignoring surrounding whitespace and letter case."""
    return str(value).strip().casefold()


def _stamp(record: dict) -> str:
    """The record's updated_at; a missing or None value is older than any other."""
    return record.get("updated_at") or ""


def _combine(kept: dict, newer: dict) -> dict:
    """Combine the record kept so far for an id with a later record for the same id."""
    if _stamp(newer) >= _stamp(kept):
        winner, other = newer, kept
    else:
        winner, other = kept, newer
    combined = dict(winner)
    for field, value in other.items():
        if combined.get(field) is None and value is not None:
            combined[field] = value
    return combined


def _find(records: list[dict], record_id) -> int:
    """Position of the record in `records` with this id, or -1."""
    for i, record in enumerate(records):
        if normalize_id(record["id"]) == normalize_id(record_id):
            return i
    return -1


def merge_records(base: Iterable[dict], incoming: Iterable[dict]) -> list[dict]:
    """Merge `base` and `incoming` into one list with one record per id.

    See the README for the rules (ordering, which record wins, how ties are broken).
    """
    merged: list[dict] = []
    for record in [*base, *incoming]:
        i = _find(merged, record["id"])
        if i < 0:
            merged.append(dict(record))
        else:
            merged[i] = _combine(merged[i], record)
    return merged
