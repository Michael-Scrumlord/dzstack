#!/usr/bin/env bash
# Hidden checks: the stock counters hold in every interleaving of cancel, expiry, redelivery, retry overlap and reconcile
# (driven with a manual clock, a manual transport and a scripted warehouse); the release is idempotent when attempts hang,
# fail or answer late; no release is lost. Then the visible suite, a regression test that fails on the original code,
# and scope (source, tests and docs only).
source /harness/lib.sh
w=$(work_copy)

hidden() {
	local f=$1
	rm -rf "$w/test/hidden" && mkdir -p "$w/test/hidden" && cp /hidden/support.ts "/hidden/$f" "$w/test/hidden/" || return 1
	cd "$w" && timeout 300 node --test --test-concurrency=1 --test-timeout=30000 "test/hidden/$f"
}
check "hidden tests: the counters hold in every interleaving of cancel, expiry, redelivery and reconcile" 3 yes hidden invariant.hidden.test.ts
check "hidden tests: hung, failing and late warehouse calls release the stock exactly once" 3 yes hidden retry.hidden.test.ts
check "hidden tests: no release is lost (cancel is immediate, expiry works, reconcile still catches stragglers)" 2 yes hidden lost.hidden.test.ts

visible() { cd "$w" && rm -rf test/hidden && timeout 300 node --test; }
check "the project's own tests pass" 1 yes visible

tests=$(added_files '^test/.*\.test\.ts$')
red_first() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# shellcheck disable=SC2086
	! (cd "$o" && timeout 300 node --test $tests)
}
check "a test was added that fails on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(src/.*\.ts|test/.*\.ts|docs/.*\.md|README\.md)$'; }
check "changes stay in source, tests and docs" 1 no scope
