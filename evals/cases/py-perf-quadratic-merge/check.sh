#!/usr/bin/env bash
# Hidden tests (edge cases, agreement with the original on random inputs, and a 200,000-record
# timing run in its own process), the visible suite, a test the agent added that fails on the
# original code (a scaling test would time out there), and scope.
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1

hidden() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	cp /hidden/test_merge_hidden.py /hidden/oracle_hidden.py /hidden/timing_child_hidden.py tests/ || return 1
	python3 -m pytest -q -p no:cacheprovider tests/test_merge_hidden.py
}
check "hidden tests: same results as before, and 200,000 records in under 5 s" 3 yes hidden

visible() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	python3 -m pytest -q -p no:cacheprovider
}
check "the project's own tests pass" 1 yes visible

tests=$(added_files '^tests/test_.*\.py$')
red_first() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o rc
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# shellcheck disable=SC2086
	(cd "$o" && timeout 45 python3 -m pytest -q -p no:cacheprovider $tests)
	rc=$?
	[ $rc -eq 1 ] || [ $rc -eq 2 ] || [ $rc -eq 124 ]  # tests failed, could not be collected, or timed out
}
check "a test was added that fails (or times out) on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(recsync/.*\.py|tests/.*\.py|README\.md)$'; }
check "changes stay in the package, its tests and the README" 1 no scope
