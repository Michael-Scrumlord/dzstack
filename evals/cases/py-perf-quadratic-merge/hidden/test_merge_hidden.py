"""Hidden checks: the merge rules on edge cases, agreement with the original on random inputs, and speed."""
import copy
import json
import random
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

from oracle_hidden import merge_original, merge_reference  # noqa: E402
from recsync import merge_records  # noqa: E402

T1, T2, T3 = "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z"


def rec(id, updated_at=None, **fields):
    return {"id": id, "updated_at": updated_at, **fields}


# ---- the rules, spelled out ----

def test_later_timestamp_wins_inside_one_list_even_when_it_comes_first():
    out = merge_records([rec("a", T3, name="newest"), rec("a", T1, name="oldest"), rec("a", T2, name="middle")], [])
    assert out == [rec("a", T3, name="newest")]


def test_ties_go_to_the_record_processed_later():
    assert merge_records([rec("a", T1, v=1), rec("a", T1, v=2), rec("a", T1, v=3)], []) == [rec("a", T1, v=3)]
    assert merge_records([rec("a", T1, v="base")], [rec("a", T1, v="incoming")])[0]["v"] == "incoming"
    assert merge_records([rec("a", None, v="base")], [rec("a", None, v="incoming")])[0]["v"] == "incoming"


def test_a_missing_or_null_timestamp_is_older_than_any_timestamp():
    assert merge_records([rec("a", T1, v="dated")], [{"id": "a", "v": "undated"}])[0]["v"] == "dated"
    assert merge_records([{"id": "a", "v": "undated"}], [rec("a", T1, v="dated")])[0]["v"] == "dated"
    assert merge_records([rec("a", None, v="null")], [rec("a", "", v="empty")])[0]["v"] == "empty"


def test_gaps_in_the_winner_are_filled_from_the_other_record():
    out = merge_records(
        [rec("a", T1, name="Old Name", email="old@example.com", plan="free", only_old=1)],
        [rec("a", T2, name=None, email="new@example.com", only_new=2)],
    )
    assert out == [{"id": "a", "updated_at": T2, "name": "Old Name", "email": "new@example.com",
                    "plan": "free", "only_old": 1, "only_new": 2}]


def test_a_null_stays_when_neither_record_has_a_value():
    out = merge_records([rec("a", T1, name=None)], [rec("a", T2, name=None, nick=None)])
    assert out == [{"id": "a", "updated_at": T2, "name": None, "nick": None}]


def test_the_rules_apply_one_record_at_a_time_in_processing_order():
    # after records 1 and 2 the kept record has x=7 (filled from record 2); record 3 is older, so it only fills gaps.
    out = merge_records([rec("a", T3, x=None), rec("a", T1, x=7)], [rec("a", T2, x=8, y=9)])
    assert out == [{"id": "a", "updated_at": T3, "x": 7, "y": 9}]


def test_ids_match_ignoring_case_whitespace_and_type():
    out = merge_records([rec("Ab-1", T1, v=1), rec(5, T1, v=1)], [rec("  aB-1", T2, v=2), rec(" 5 ", T2, v=2), rec("5", T3, v=3)])
    assert [r["v"] for r in out] == [2, 3]
    assert len(out) == 2


def test_ids_match_with_full_case_folding():
    out = merge_records([rec("Straße-1", T1, v="base")], [rec("STRASSE-1", T2, v="incoming")])
    assert len(out) == 1 and out[0]["v"] == "incoming"


def test_the_combined_record_carries_the_winners_id_as_written():
    assert merge_records([rec("A-1", T1)], [rec("a-1", T2)])[0]["id"] == "a-1"
    assert merge_records([rec("A-1", T2)], [rec(" a-1 ", T1)])[0]["id"] == "A-1"
    assert merge_records([rec("A-1", T1)], [rec("a-1", T1)])[0]["id"] == "a-1"


def test_output_order_is_first_appearance_and_updates_do_not_move_records():
    base = [rec("m", T1), rec("c", T1), rec("m", T2), rec("z", T1)]
    incoming = [rec("q"), rec("C", T3), rec("a"), rec("Q", T3), rec("z", T3), rec("b")]
    ids = [r["id"].strip().lower() for r in merge_records(base, incoming)]
    assert ids == ["m", "c", "z", "q", "a", "b"]


def test_empty_inputs():
    assert merge_records([], []) == []
    assert merge_records([rec("a", T1)], []) == [rec("a", T1)]
    assert merge_records([], [rec("a", T1)]) == [rec("a", T1)]
    assert merge_records([], [rec("b"), rec("a"), rec("B", T1)]) == [rec("B", T1), rec("a")]


def test_inputs_are_untouched_and_results_are_new_dicts():
    base = [rec("a", T1, name="x"), rec("b", T1)]
    incoming = [rec("a", T2, name=None, plan="pro"), rec("c", T1)]
    before = copy.deepcopy((base, incoming))
    out = merge_records(base, incoming)
    assert (base, incoming) == before
    assert all(o is not r for o in out for r in base + incoming)
    out[0]["name"] = "changed"
    out[2]["name"] = "changed"
    assert (base, incoming) == before


def test_accepts_any_iterable():
    base = [rec("a", T1, v=1), rec("b", T1)]
    incoming = [rec("a", T2, v=2)]
    assert merge_records(iter(base), (r for r in incoming)) == merge_records(base, incoming)


@pytest.mark.parametrize("base, incoming", [
    ([{"name": "no id"}], []),
    ([], [{"name": "no id"}]),
    ([rec("a")], [rec("b"), {"updated_at": T1}]),
])
def test_a_record_without_an_id_is_a_key_error(base, incoming):
    with pytest.raises(KeyError):
        merge_records(base, incoming)


# ---- the same results as the original code, on random inputs ----

def random_records(rng, n, pool):
    def written(k):
        text = rng.choice(["id-%d", "ID-%d", " Id-%d ", "ß%d"]) % k
        return rng.choice([text, k]) if rng.random() < 0.1 else text

    stamps = [None, "", T1, T1, T2, T2, T3]
    return [
        {"id": written(rng.randrange(pool)), **({"updated_at": rng.choice(stamps)} if rng.random() < 0.9 else {}),
         **{f: rng.choice([None, f"{f}{rng.randrange(4)}"]) for f in ("a", "b", "c") if rng.random() < 0.7}}
        for _ in range(n)
    ]


@pytest.mark.parametrize("seed", range(300))
def test_matches_the_original_on_small_random_inputs(seed):
    rng = random.Random(seed)
    pool = rng.choice([2, 5, 12, 40])
    base = random_records(rng, rng.randrange(0, 40), pool)
    incoming = random_records(rng, rng.randrange(0, 40), pool)
    assert merge_records(copy.deepcopy(base), copy.deepcopy(incoming)) == merge_original(base, incoming)


@pytest.mark.parametrize("seed", range(5))
def test_matches_the_original_on_larger_random_inputs(seed):
    rng = random.Random(1000 + seed)
    base = random_records(rng, 400, 500)
    incoming = random_records(rng, 300, 500)
    assert merge_records(base, incoming) == merge_original(base, incoming)


def test_the_reference_used_for_the_big_run_agrees_with_the_original():
    rng = random.Random(77)
    base = random_records(rng, 500, 300)
    incoming = random_records(rng, 500, 300)
    assert merge_reference(base, incoming) == merge_original(base, incoming)


# ---- speed ----

def test_two_hundred_thousand_records_merge_in_under_five_seconds():
    try:
        proc = subprocess.run([sys.executable, "-B", str(HERE / "timing_child_hidden.py"), str(ROOT)],
                              capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        pytest.fail("merging 200,000 records did not finish within 30 seconds (the limit is 5)")
    assert proc.returncode == 0, proc.stderr[-1500:]
    report = json.loads(proc.stdout.strip().splitlines()[-1])
    assert report["records"] == 200_000
    assert report["same_as_reference"], "the merged result differs from the reference"
    assert report["seconds"] < 5.0, f"merge_records took {report['seconds']} s for {report['records']} records (limit 5 s)"
