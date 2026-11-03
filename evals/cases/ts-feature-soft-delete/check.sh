#!/usr/bin/env bash
# Hidden tests across all three layers (repository, service, handlers), the
# visible suite, tests added for the feature, and scope (source, tests, README).
source /harness/lib.sh
w=$(work_copy)

hidden() { cp /hidden/soft-delete.hidden.test.ts "$w/test/" && cd "$w" && node --test test/soft-delete.hidden.test.ts; }
check "hidden tests: soft delete, restore and the admin listing, in every layer" 5 yes hidden

visible() { cd "$w" && rm -f test/soft-delete.hidden.test.ts && node --test; }
check "the project's own tests pass" 1 yes visible

tests=$(added_files '\.test\.ts$')
tests_for_feature() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# The agent's tests only count if they exercise something the original code can't do.
	# shellcheck disable=SC2086
	! (cd "$o" && node --test $tests)
}
check "tests were added that fail on the original code" 1 no tests_for_feature

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/[^/]+\.ts|test/[^/]+\.test\.ts|README\.md)$'; }
check "changes stay in source, tests and the README" 1 no scope
