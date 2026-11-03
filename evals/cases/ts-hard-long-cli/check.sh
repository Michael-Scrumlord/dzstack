#!/usr/bin/env bash
# Hidden tests that run the CLI as a subprocess against temp stores, one group per part of
# docs/SPEC.md (general rules, dates, add, done, undo, edit, report, atomic writes with the
# fs hook); the visible suite; a test added for the new commands; and scope.
source /harness/lib.sh
w=$(work_copy)

hidden() {
	cp /hidden/spec.hidden.test.ts "$w/test/" || return 1
	cd "$w" || return 1
	local out rc
	out=$(node --test --test-name-pattern="$1" test/spec.hidden.test.ts 2>&1)
	rc=$?
	printf '%s\n' "$out" | grep -E '^(✖|ℹ (tests|pass|fail))' | head -40
	[ $rc -eq 0 ] && printf '%s\n' "$out" | grep -qE '^ℹ pass [1-9]'
}
check "general rules: help, store lookup, TASKS_TODAY, exit codes 65 and 74, checks before reading" 2 yes hidden '\[general\]'
check "dates: ISO, today/tomorrow/yesterday, +Nd/-Nw, calendar math in any time zone, limits" 2 yes hidden '\[dates\]'
check "add: arguments, normalising, ids, journal, every error" 3 yes hidden '\[add\]'
check "done: several ids, repeats, already done, errors, no write without a change" 2 yes hidden '\[done\]'
check "undo: add, done and edit, the journal limit, errors" 2 yes hidden '\[undo\]'
check "edit: each field, tags, no-change, ordering of checks, errors" 3 yes hidden '\[edit\]'
check "report: text and JSON, windows, sorting, filters, errors" 3 yes hidden '\[report\]'
check "atomic writes: temp file and rename, failures and crashes leave the store intact, the fs hook" 3 yes hidden '\[atomic\]'

visible() { cd "$w" && rm -f test/spec.hidden.test.ts && node --test; }
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

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/.*\.ts|test/.*\.ts|docs/.*\.md|README\.md)$'; }
check "changes stay in source, tests and the docs" 1 no scope
