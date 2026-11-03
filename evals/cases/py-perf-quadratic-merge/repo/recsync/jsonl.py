"""One JSON object per line."""
from __future__ import annotations

import json
from typing import Iterable, Iterator


def read_jsonl(path: str) -> Iterator[dict]:
    with open(path, encoding="utf-8") as fh:
        for number, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}, line {number}: {exc.msg}") from None
            if not isinstance(record, dict):
                raise ValueError(f"{path}, line {number}: expected a JSON object")
            yield record


def write_jsonl(path: str, records: Iterable[dict]) -> int:
    count = 0
    with open(path, "w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count
