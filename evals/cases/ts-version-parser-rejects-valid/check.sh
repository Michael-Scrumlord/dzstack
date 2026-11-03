#!/usr/bin/env bash
# Hidden behavior tests (valid, invalid, precedence, updater), the visible suite, a regression
# test that fails on the original code, and scope (only the version module and tests changed).
source /harness/lib.sh
w=$(work_copy)

hidden() { cp "/hidden/$1" "$w/test/" && cd "$w" && node --test "test/$1"; }
check "hidden tests: valid versions are accepted (rc.1+build.7, hyphens, the spec's examples)" 3 yes hidden parse-valid.hidden.test.ts
check "hidden tests: invalid versions are still rejected (leading zeros, empty identifiers, 1.2)" 2 yes hidden parse-invalid.hidden.test.ts
check "hidden tests: precedence follows the spec" 3 yes hidden precedence.hidden.test.ts
check "hidden tests: the updater picks the release candidate" 2 yes hidden updater.hidden.test.ts

visible() { cd "$w" && rm -f test/*.hidden.test.ts && node --test; }
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

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/semver\.ts|test/.*\.test\.ts)$'; }
check "changes stay in the version module and tests" 1 no scope
