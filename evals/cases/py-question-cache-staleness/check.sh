#!/usr/bin/env bash
# ANSWER.md exists and the code is untouched (required); length, the right file and a line citation
# are craft. Whether the explanation is correct is the rubric's job.
source /harness/lib.sh

answer_exists() { [ -s /work/ANSWER.md ]; }
check "ANSWER.md exists and is not empty" 1 yes answer_exists

source_untouched() {
	local bad
	bad=$(awk -F'\t' '$2 != "ANSWER.md" && ($1 ~ /^[MD]/ || $2 ~ /^(catalog|tests)\//) { print $1 " " $2 }' /meta/changed.txt)
	[ -z "$bad" ] || { echo "changed: $bad"; return 1; }
}
check "no source file was changed" 1 no source_untouched

# Words are whitespace-separated tokens with a letter or digit in them (markers like "-" or "##" don't count).
short() {
	local n
	[ -s /work/ANSWER.md ] || { echo "no ANSWER.md"; return 1; }
	n=$(tr -s '[:space:]' '\n' </work/ANSWER.md | grep -c '[[:alnum:]]')
	echo "$n words"
	[ "$n" -lt 300 ]
}
check "ANSWER.md is under 300 words" 1 no short

names_the_file() { grep -qi 'service\.py' /work/ANSWER.md; }
check "ANSWER.md names catalog/service.py, where the invalidation is" 1 no names_the_file

# update_price invalidates at service.py:25, then its transaction block (service.py:26-34) commits on
# exit, in Store.transaction (store.py:54). The span stops short of discontinue (service.py:36).
cites_the_order() { python3 -I /hidden/check_cite.py service.py:25-31 store.py:54; }
check "ANSWER.md cites the invalidate/commit lines of update_price" 1 no cites_the_order
