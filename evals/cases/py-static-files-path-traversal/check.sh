#!/usr/bin/env bash
# Hidden behavior tests (traversal, symlinks, ordinary requests, NUL bytes, the HTTP front end), the
# visible suite, a regression test that fails on the original code, and scope (only the handler and tests).
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1
w=$(work_copy)

hidden() { mkdir -p "$w/tests" && cp /hidden/test_security_hidden.py "$w/tests/" && cd "$w" && python3 -m pytest -q -p no:cacheprovider "${@/#/tests/test_security_hidden.py::}"; }
# The required checks accept a 403 or a 404 refusal: the security outcome is that nothing leaks.
lenient() { EVAL_LENIENT_STATUS=1 hidden "$@"; }
check "hidden tests: '..', encoded '..', absolute paths and sibling folders cannot leave the root" 3 yes lenient TestTraversal
check "hidden tests: symlinks pointing outside the root are refused" 3 yes lenient TestSymlinks
check "hidden tests: ordinary requests still work (nested files, 404, directories, backslashes, inner links, a symlinked root)" 2 yes hidden TestServing
check "hidden tests: a path that can't name a file (a NUL byte) is a 404, not a crash" 1 yes hidden TestUnnamable
check "hidden tests: the same through the HTTP front end" 1 yes lenient TestHttp
check "refusals answer 403 Forbidden, as the README says" 1 no hidden TestTraversal TestSymlinks TestHttp

visible() { cd "$w" && rm -f tests/test_security_hidden.py && python3 -m pytest -q -p no:cacheprovider; }
check "the project's own tests pass" 1 yes visible

tests=$(added_files '^tests/.*\.py$')
red_first() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# shellcheck disable=SC2086
	! (cd "$o" && python3 -m pytest -q -p no:cacheprovider $tests)
}
check "a test was added that fails on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(staticsite/handler\.py|tests/.*\.py)$'; }
check "changes stay in the handler and tests" 1 no scope
