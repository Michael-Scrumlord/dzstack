#!/usr/bin/env bash
# Hidden tests that drive concurrent saves through a persistence fake in many orders (merging,
# conflicts and retries, shares, cold documents, failing persistence, independent documents) and
# check the written rules one request after another; the visible suite; a test added for the fix;
# and scope.
source /harness/lib.sh
w=$(work_copy)

hidden() {
	cp /hidden/lost-update.hidden.test.ts "$w/test/" || return 1
	cd "$w" || return 1
	local out rc
	out=$(node --test --test-name-pattern="$1" test/lost-update.hidden.test.ts 2>&1)
	rc=$?
	printf '%s\n' "$out" | tail -60
	[ $rc -eq 0 ] && printf '%s\n' "$out" | grep -qE '^ℹ pass [1-9]'
}
check "concurrent saves: nothing is lost, conflicts get a 409 and a retry works, in every order" 4 yes hidden '\[concurrent\]'
check "the written rules: merge, conflicts, no-op saves, base versions and the audit log" 3 yes hidden '\[rules\]'
check "failing persistence leaves no trace and does not drag other saves down" 2 yes hidden '\[failure\]'
check "saves to different documents do not wait for each other" 1 yes hidden '\[independent\]'

visible() { cd "$w" && rm -f test/lost-update.hidden.test.ts && node --test; }
check "the project's own tests pass" 1 yes visible

tests=$(added_files '\.test\.ts$')
tests_for_fix() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# The agent's tests only count if the original code fails them.
	# shellcheck disable=SC2086
	! (cd "$o" && node --test $tests)
}
check "tests were added that fail on the original code" 1 no tests_for_fix

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/[^/]+\.ts|test/[^/]+\.ts|README\.md)$'; }
check "changes stay in source, tests and the README" 1 no scope
