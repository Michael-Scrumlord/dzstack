"""Runs in its own process: merge about 200,000 records and report how long merge_records took."""
import json
import sys
import time
from pathlib import Path

root, here = sys.argv[1], str(Path(__file__).resolve().parent)
sys.path.insert(0, root)
sys.path.insert(0, here)

from oracle_hidden import big_dataset, merge_reference  # noqa: E402
from recsync import merge_records  # noqa: E402

base, incoming = big_dataset()
start = time.perf_counter()
result = merge_records(base, incoming)
seconds = time.perf_counter() - start

expected = merge_reference(base, incoming)
print(json.dumps({
    "records": len(base) + len(incoming),
    "merged": len(result),
    "seconds": round(seconds, 3),
    "same_as_reference": result == expected,
}))
