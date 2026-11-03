#!/usr/bin/env bash
# Hidden behavior tests (late and failing answers, clearing, independent boxes),
# the visible suite, a regression test that fails on the original code, and
# scope (only source and test files changed).
source /harness/lib.sh
w=$(work_copy)

hidden() { cp /hidden/search-box.hidden.test.ts "$w/test/" && cd "$w" && node --test test/search-box.hidden.test.ts; }
check "hidden tests: the latest query's results win" 3 yes hidden

visible() { cd "$w" && rm -f test/search-box.hidden.test.ts && node --test; }
check "the project's own tests pass" 1 yes visible

tests=$(added_files '\.test\.ts$')
red_first() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# shellcheck disable=SC2086
	! (cd "$o" && node --test $tests)
}
check "a test was added that fails on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/.*\.ts|test/.*\.test\.ts)$'; }
check "changes stay in source and tests" 1 no scope
