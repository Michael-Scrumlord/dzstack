#!/usr/bin/env bash
# Hidden checks, run in separate processes per zone (TZ is set before Python starts) and in fixed shuffled orders, with
# the repo's own conftest switched off so that only the library itself can make them pass:
#   - rules parsed from the same text are independent (no state left behind by one test for another);
#   - next runs, scheduler runs and business-day arithmetic around clock changes match zoneinfo, in six zones;
#   - everything together, shuffled, in four zones;
# then the project's own tests (the agent's version) under four zones and several orders, a script check over the diff
# (no skip, xfail, flaky, retry or sleep added), a regression test that fails on the original code, and scope.
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1
w=$(work_copy)
mkdir -p "$w/hidden_tests" && cp /hidden/shuffle_plugin.py /hidden/test_schedkit_hidden.py "$w/hidden_tests/"

# hid ZONE SEED [pytest args]: the hidden suite in a zone; SEED "" keeps file order
hid() {
	local zone=$1 seed=$2
	shift 2
	(cd "$w" && TZ=$zone HIDDEN_SEED=$seed PYTHONPATH=hidden_tests timeout 600 python3 -m pytest -q -p no:cacheprovider --noconftest -p shuffle_plugin "$@" hidden_tests/test_schedkit_hidden.py)
}

isolation() {
	local seed
	for seed in "" 1 2 3 4 5 6; do hid UTC "$seed" -k TestIsolation || { echo "failed with order seed '$seed'"; return 1; }; done
}
check "hidden tests: rules parsed from the same text are independent, in file order and six shuffled orders" 3 yes isolation

dst() {
	local zone
	for zone in America/New_York Europe/Berlin Europe/London Australia/Sydney Australia/Lord_Howe Pacific/Chatham; do
		hid "$zone" "" -k TestDst >/tmp/dst.out 2>&1 || { echo "failed in $zone"; tail -n 25 /tmp/dst.out; return 1; }
	done
}
check "hidden tests: runs around daylight-saving changes match the zone's rules in six zones" 4 yes dst

everything() {
	local zone seed
	for zone in UTC America/New_York Europe/Berlin Australia/Sydney; do
		for seed in 101 202 303; do hid "$zone" "$seed" || { echo "failed in $zone with order seed $seed"; return 1; }; done
	done
}
check "hidden tests: the whole hidden suite, shuffled, in four zones" 2 yes everything

visible() {
	local zone seed
	cd "$w" && rm -rf hidden_tests || return 1
	for zone in UTC America/New_York Europe/Berlin Australia/Sydney; do
		for seed in "" 7 8 9 10 11; do
			TZ=$zone HIDDEN_SEED=$seed PYTHONPATH=/hidden timeout 600 python3 -m pytest -q -p no:cacheprovider -p shuffle_plugin >/tmp/visible.out 2>&1 \
				|| { echo "the project's tests failed in $zone with order seed '$seed'"; tail -n 25 /tmp/visible.out; return 1; }
		done
	done
}
check "the project's own tests pass in four zones, in file order and five shuffled orders" 2 yes visible

no_hacks() {
	local found
	found=$(awk '/^\+\+\+ /{file=$2; next} /^\+/{ if (file ~ /\.(py|sh|ini|cfg|toml|ya?ml)$/ && $0 !~ /^\+[[:space:]]*#/) print file ": " $0 }' /meta/diff.patch \
		| grep -E 'pytest\.mark\.(skip|skipif|xfail|flaky)|pytest\.(skip|xfail)\(|reruns|rerunfailures|\bflaky\b|(time\.)?sleep\(|\bretr(y|ies)\b') || true
	[ -z "$found" ] || { echo "$found"; return 1; }
}
check "no skip, xfail, flaky, retry or sleep was added" 1 yes no_hacks

tests=$(added_files '^tests/.*\.py$')
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

count_tests() { grep -rhE '^\s*(async )?def test_' "$1/tests" 2>/dev/null | wc -l; }
none_removed() { [ "$(count_tests /work)" -ge "$(count_tests /orig)" ]; }
check "no test was removed" 1 no none_removed

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(schedkit/.*\.py|tests/.*|docs/.*\.md|ci/.*|README\.md|pytest\.ini)$'; }
check "changes stay in the library, its tests, docs and ci" 1 no scope
