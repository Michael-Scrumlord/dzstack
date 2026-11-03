"""Invoice numbers: YYYY-NNNN, counted per year, kept in <store>/counter.json."""
from __future__ import annotations

import json
from pathlib import Path


def next_number(root: Path, year: int) -> str:
    path = Path(root) / "counter.json"
    counters = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    n = counters.get(str(year), 0) + 1
    counters[str(year)] = n
    path.write_text(json.dumps(counters, sort_keys=True) + "\n", encoding="utf-8")
    return f"{year}-{n:04d}"
