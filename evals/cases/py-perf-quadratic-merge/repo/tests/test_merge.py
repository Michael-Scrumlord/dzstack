from recsync import merge_records


def rec(id, updated_at=None, **fields):
    return {"id": id, "updated_at": updated_at, **fields}


def test_disjoint_lists_are_concatenated():
    out = merge_records([rec("a", name="A")], [rec("b", name="B")])
    assert [r["id"] for r in out] == ["a", "b"]


def test_empty_inputs():
    assert merge_records([], []) == []
    assert merge_records([rec("a")], []) == [rec("a")]
    assert merge_records([], [rec("a")]) == [rec("a")]


def test_newer_record_wins_across_lists():
    out = merge_records([rec("a", "2026-01-02T00:00:00Z", plan="free")],
                        [rec("a", "2026-01-03T00:00:00Z", plan="pro")])
    assert out == [rec("a", "2026-01-03T00:00:00Z", plan="pro")]


def test_older_incoming_record_loses():
    out = merge_records([rec("a", "2026-01-05T00:00:00Z", plan="pro")],
                        [rec("a", "2026-01-01T00:00:00Z", plan="free")])
    assert out[0]["plan"] == "pro"


def test_tie_goes_to_the_record_processed_later():
    stamp = "2026-01-01T00:00:00Z"
    assert merge_records([rec("a", stamp, plan="base")], [rec("a", stamp, plan="incoming")])[0]["plan"] == "incoming"
    assert merge_records([rec("a", stamp, plan="first"), rec("a", stamp, plan="second")], [])[0]["plan"] == "second"


def test_duplicates_inside_one_list_collapse():
    out = merge_records([rec("a", "2026-01-02T00:00:00Z", name="old"), rec("b"),
                         rec("a", "2026-01-03T00:00:00Z", name="new")], [])
    assert [(r["id"], r.get("name")) for r in out] == [("a", "new"), ("b", None)]


def test_missing_fields_are_filled_from_the_other_record():
    out = merge_records([rec("a", "2026-01-01T00:00:00Z", email="a@example.com", plan="free")],
                        [rec("a", "2026-01-02T00:00:00Z", email=None, plan="pro", seats=3)])
    assert out == [{"id": "a", "updated_at": "2026-01-02T00:00:00Z", "email": "a@example.com", "plan": "pro", "seats": 3}]


def test_missing_updated_at_is_oldest():
    out = merge_records([rec("a", None, plan="undated")], [rec("a", "2026-01-01T00:00:00Z", plan="dated")])
    assert out[0]["plan"] == "dated"


def test_ids_match_ignoring_case_whitespace_and_type():
    out = merge_records([rec("C-7", "2026-01-01T00:00:00Z", name="x"), rec(42, "2026-01-01T00:00:00Z")],
                        [rec(" c-7 ", "2026-01-02T00:00:00Z", name="y"), rec("42", "2026-01-02T00:00:00Z")])
    assert len(out) == 2
    assert out[0]["id"] == " c-7 " and out[0]["name"] == "y"
    assert out[1]["id"] == "42"


def test_order_is_first_appearance_and_updates_do_not_move_records():
    base = [rec("b", "2026-01-01T00:00:00Z"), rec("a", "2026-01-01T00:00:00Z")]
    incoming = [rec("c"), rec("a", "2026-02-01T00:00:00Z"), rec("b", "2026-02-01T00:00:00Z"), rec("d")]
    assert [r["id"] for r in merge_records(base, incoming)] == ["b", "a", "c", "d"]


def test_inputs_are_not_modified():
    base = [rec("a", "2026-01-01T00:00:00Z", name="x")]
    incoming = [rec("a", "2026-01-02T00:00:00Z", name=None, plan="pro")]
    before = ([dict(r) for r in base], [dict(r) for r in incoming])
    out = merge_records(base, incoming)
    out[0]["name"] = "changed"
    assert (base, incoming) == before


def test_accepts_any_iterable():
    out = merge_records(iter([rec("a")]), (rec("b"),))
    assert [r["id"] for r in out] == ["a", "b"]


def test_a_record_without_an_id_is_an_error():
    import pytest
    with pytest.raises(KeyError):
        merge_records([{"name": "no id"}], [])
