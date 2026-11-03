#!/usr/bin/env bash
# Hidden behavior tests: registration through the documented mechanism (registry, runner, `formats`), selection from the
# command line, environment and config file, the conventions of docs/plugins.md (header, BOM, CRLF, quoting, machine
# values, formula guard for text only), options, streaming with a one-shot generator and a bounded buffer, and the
# existing formats unchanged. Then the visible suite, a regression test that fails on the original code, scope, and
# craft (no format-specific code in the CLI, runner or config loader; the docs list the format).
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1
w=$(work_copy)

hidden() { cp /hidden/test_csv_hidden.py "$w/tests/" && cd "$w" && python3 -m pytest -q -p no:cacheprovider "${@/#/tests/test_csv_hidden.py::}"; }
check "hidden tests: csv is registered the documented way and found by the registry, the runner and 'formats'" 3 yes hidden TestRegistration
check "hidden tests: --format csv, REPORTLY_FORMAT and format = \"csv\" in the config file, output files, row errors" 3 yes hidden TestSelection
check "hidden tests: header titles, BOM, CRLF, quoting, machine values, formula guard on text but not on numbers" 4 yes hidden TestConventions
check "hidden tests: rows are streamed once from a one-shot generator and never collected" 3 yes hidden TestStreaming
check "hidden tests: text, markdown and the value helpers behave as before" 2 yes hidden TestExistingFormatsAreUnchanged

visible() { cd "$w" && rm -f tests/test_csv_hidden.py && python3 -m pytest -q -p no:cacheprovider; }
check "the project's own tests pass" 1 yes visible

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

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(reportly/.*\.py|tests/.*\.py|docs/.*\.md|README\.md)$'; }
check "changes stay in the package, its tests and the docs" 1 no scope

no_special_case() { ! grep -n -E "[\"']csv[\"']" "$w"/reportly/cli.py "$w"/reportly/runner.py "$w"/reportly/config.py "$w"/reportly/reports.py "$w"/reportly/plugins/*.py; }
check "no format-specific code in the CLI, runner, config loader or registry" 1 no no_special_case

docs_list_it() { grep -q '`csv`' "$w/docs/plugins.md"; }
check "the docs list the new format" 1 no docs_list_it
