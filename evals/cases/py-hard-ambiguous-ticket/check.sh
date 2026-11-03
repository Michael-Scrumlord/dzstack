#!/usr/bin/env bash
# Hidden tests (grouped: the figures, the documents, the rendering, issued invoices and the ledger), the visible
# suite, NOTES.md. The hidden tests check only what docs/ and the code settle; how a fixed discount is spread over
# several lines is left open, and nothing here depends on it. The rubric grades NOTES.md.
source /harness/lib.sh
export PYTHONDONTWRITEBYTECODE=1 HIDDEN_DIR=/hidden

hidden_group() { # $1 = pytest -k expression
	local w out rc
	w=$(work_copy) && cd "$w" || return 1
	cp /hidden/test_discounts_hidden.py tests/ || return 1
	out=$(timeout 60 python3 -m pytest -q -p no:cacheprovider -x tests/test_discounts_hidden.py -k "$1" 2>&1)
	rc=$?
	[ $rc -eq 0 ] || printf '%s\n' "$out" | tail -25
	[ $rc -eq 0 ] && printf '%s\n' "$out" | tail -2
	return $rc
}

figures() { hidden_group "test_percent or test_tax or test_discounts_stack or test_the_order or test_a_discount_never or test_a_fixed_discount or test_figures_for_random or test_the_computed_form"; }
check "hidden: the figures (before tax, per line, half up, stacking, never below zero, exact fixed amounts)" 4 yes figures

documents() { hidden_group "invalid_discount or error_messages or valid_extremes or at_most_five or command_line_reports"; }
check "hidden: the document format (validation, limits, error messages, exit status 2)" 2 yes documents

rendering() { hidden_group "the_printed_invoice or long_label or emailed or without_discounts_look"; }
check "hidden: the printed and the emailed invoice (own row, order, escaping, unchanged without discounts)" 2 yes rendering

ledger() { hidden_group "stored_before or ledger_export or reminders_aging or discounted_invoice_is_stored or reminders_ask or command_line_end_to_end or documents_are_not_modified"; }
check "hidden: issued invoices, old and new, reprints, the ledger CSV, reminders" 2 yes ledger

visible() {
	local w
	w=$(work_copy) && cd "$w" || return 1
	timeout 60 python3 -m pytest -q -p no:cacheprovider
}
check "the project's own tests pass" 1 yes visible

notes_exist() { [ -s /work/NOTES.md ]; }
check "NOTES.md exists and is not empty" 1 yes notes_exist

notes_short() {
	[ -s /work/NOTES.md ] || { echo "no NOTES.md"; return 1; }
	local n
	n=$(tr -s '[:space:]' '\n' </work/NOTES.md | grep -c '[[:alnum:]]')
	echo "$n words"
	[ "$n" -le 400 ]
}
check "NOTES.md is at most 400 words" 1 no notes_short

tests=$(added_files '^tests/test_.*\.py$')
red_first() {
	[ -n "$tests" ] || { echo "no test file added or changed"; return 1; }
	local o rc
	o=$(orig_copy)
	for t in $tests; do mkdir -p "$o/$(dirname "$t")" && cp "/work/$t" "$o/$t"; done
	# shellcheck disable=SC2086
	(cd "$o" && timeout 60 python3 -m pytest -q -p no:cacheprovider $tests)
	rc=$?
	[ $rc -eq 1 ] || [ $rc -eq 2 ]  # tests failed, or could not be collected
}
check "a test was added that fails on the original code" 1 no red_first

scope() { ! awk -F'\t' '{print $2}' /meta/changed.txt | grep -v -E '^(billing/.*\.py|tests/.*\.py|docs/.*\.md|README\.md|NOTES\.md)$'; }
check "changes stay in the package, its tests, the docs and NOTES.md" 1 no scope
