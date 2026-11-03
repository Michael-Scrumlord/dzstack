#!/usr/bin/env bash
# The behavior is intended and documented: the right outcome is an explanation in NOTES.md and no
# change under src/. Whether the explanation is right is the rubric's job.
source /harness/lib.sh
w=$(work_copy)

notes_exist() { [ -s /work/NOTES.md ]; }
check "NOTES.md exists and is not empty" 1 yes notes_exist

src_unchanged() {
	local bad
	bad=$(awk -F'\t' '$2 ~ /^src\// { print $1 " " $2 }' /meta/changed.txt)
	[ -z "$bad" ] || { echo "changed: $bad"; return 1; }
}
check "nothing under src/ changed" 2 no src_unchanged

visible() { cd "$w" && node --test; }
check "the project's own tests pass" 1 yes visible
