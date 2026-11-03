#!/usr/bin/env bash
# Hidden checks run the agent's app next to an oracle (the fixture's original code) on generated
# teams: identical responses for every viewer, sort, filter and page edge; a bounded number of
# queries and a bounded simulated cost whatever the page and the team (docs/performance.md); and
# no stale data when rows change between requests (docs/architecture.md). The vendored src/db is
# restored from the fixture first, so the counters being measured are the real ones.
source /harness/lib.sh

prepare() {
	w=$(work_copy) || return 1
	rm -rf "$w/src/db" && cp -a /orig/src/db "$w/src/db" || return 1
	mkdir -p "$w/oracle" "$w/hidden_tests" || return 1
	cp -a /orig/src "$w/oracle/src" || return 1
	cp /hidden/*.ts "$w/hidden_tests/"
}

# usage: run_hidden <test-name-prefix>...   (prefixes of test names in projects.hidden.test.ts)
run_hidden() {
	local args=() p out rc
	for p in "$@"; do args+=(--test-name-pattern="^$p"); done
	prepare || return 1
	cd "$w" || return 1
	out=$(timeout 150 node --test "${args[@]}" hidden_tests/projects.hidden.test.ts 2>&1)
	rc=$?
	if [ $rc -ne 0 ]; then
		printf '%s\n' "$out" | grep -E '^\s*✖|AssertionError|Error:|queries|ms simulated|differs' | head -14
	fi
	return $rc
}

same_responses() {
	run_hidden "the generated data" "every viewer" "page sizes" "search and tag" "bad parameters" "the other endpoints" "a big team"
}
check "hidden: GET /projects and the other endpoints answer exactly as the original (all viewers, sorts, filters, page edges)" 4 yes same_responses

budget() { run_hidden "a listing costs a bounded number"; }
check "hidden: at most 12 queries and 150 ms simulated per page, however many projects and whatever the page size" 3 yes budget

fresh() { run_hidden "a write made through" "a change another service" "nothing leaks"; }
check "hidden: no stale data (API writes, another service's writes, a second instance, a second database)" 3 yes fresh

visible() {
	local d
	d=$(work_copy) && cd "$d" || return 1
	timeout 30 node --test
}
check "the project's own tests pass" 1 yes visible

tests=$(added_files '^(test|testkit)/')
red_first() {
	local o t files=()
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	for t in $tests; do case "$t" in test/*.test.ts) files+=("$t") ;; esac; done
	[ ${#files[@]} -gt 0 ] || { echo "no test file added or changed"; return 1; }
	# the agent's new tests must fail on the original code (a query-count test fails on the N+1)
	! (cd "$o" && timeout 60 node --test "${files[@]}")
}
check "a test was added that fails on the original code (guards the query count)" 1 no red_first

db_untouched() { same_as_orig src/db; }
check "the vendored src/db is unchanged" 1 no db_untouched

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/|test/|testkit/|docs/|scripts/|README\.md$)'; }
check "changes stay in source, tests, docs and scripts" 1 no scope
