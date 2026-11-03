#!/usr/bin/env bash
# Hidden tests on databases at the old schema full of awkward names: the backfill, running the
# migration twice, rows the old release wrote afterwards, reads and writes through the new columns;
# the visible suite; and craft: tests added, a self-contained migration, scope.
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1

hidden() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	cp /hidden/test_split_names_hidden.py /hidden/baseline_dump.sql tests/ || return 1
	python3 -m pytest -q -p no:cacheprovider "tests/test_split_names_hidden.py::$1"
}
check "migration: every documented name format is split as docs/names.md says, no data lost" 3 yes hidden TestBackfill
check "migration: runs twice without failing, changing anything or undoing later corrections" 3 yes hidden TestRerun
check "reads (API, search, sort, roster, index, CSV, CLI, messages) use the new columns" 3 yes hidden TestReads
check "rows the old release wrote afterwards read correctly and are filled by the next run" 2 yes hidden TestOldReleaseRows
check "writes keep given_name, family_name and full_name in step, and bad names are refused" 2 yes hidden TestWrites

visible() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	rm -f tests/test_split_names_hidden.py tests/baseline_dump.sql
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
	(cd "$o" && timeout 120 python3 -m pytest -q -p no:cacheprovider $tests)
	rc=$?
	[ $rc -eq 1 ] || [ $rc -eq 2 ]  # tests failed, or could not be collected
}
check "tests were added that fail on the original code" 1 no red_first

self_contained() {
	local f bad=0
	for f in $(added_files '^staffdir/migrations/.*\.py$'); do
		if grep -E '^[[:space:]]*(from|import)[[:space:]]+(staffdir|\.)' "/work/$f"; then
			echo "$f imports the application"
			bad=1
		fi
	done
	[ $bad -eq 0 ]
}
check "the new migration does not import the application" 1 no self_contained

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(staffdir/.*\.(py|sql)|tests/.*\.py|docs/.*\.md|README\.md)$'; }
check "changes stay in the package, its tests and the docs" 1 no scope
