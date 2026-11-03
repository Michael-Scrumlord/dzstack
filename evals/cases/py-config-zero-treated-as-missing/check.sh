#!/usr/bin/env bash
# Hidden config and runner tests (every setting, every combination), the visible suite,
# a regression test that fails on the original code, and scope (the config loader and tests).
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1

hidden() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	cp /hidden/test_zero_values_hidden.py tests/ || return 1
	python3 -m pytest -q -p no:cacheprovider tests/test_zero_values_hidden.py
}
check "hidden tests: zero, false, empty, null and missing values for every setting" 3 yes hidden

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
	(cd "$o" && python3 -m pytest -q -p no:cacheprovider $tests)
	rc=$?
	[ $rc -eq 1 ] || [ $rc -eq 2 ]  # tests failed, or could not be collected
}
check "a test was added that fails on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(jobrunner/config\.py|tests/.*\.py|README\.md)$'; }
check "changes stay in the config loader, its tests and the README" 1 no scope
