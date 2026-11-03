#!/usr/bin/env bash
# REVIEW.md exists, the source is untouched, and REVIEW.md points at each planted defect
# (file and a line within 3). Whether the explanations are right is the rubric's job.
source /harness/lib.sh

review_exists() { [ -s /work/REVIEW.md ]; }
check "REVIEW.md exists and is not empty" 1 yes review_exists

source_untouched() {
	local bad
	bad=$(awk -F'\t' '$2 != "REVIEW.md" && ($1 ~ /^[MD]/ || $2 ~ /^(app|tests)\//) { print $1 " " $2 }' /meta/changed.txt)
	[ -z "$bad" ] || { echo "changed: $bad"; return 1; }
}
check "no source file or PR.diff was changed" 1 no source_untouched

defect() { python3 -I /hidden/check_review.py "$1"; }
check "REVIEW.md locates the SQL injection (file and line)" 2 no defect sqli
check "REVIEW.md locates the uncommitted transaction on the error path (file and line)" 2 no defect txn
check "REVIEW.md locates the off-by-one at the grace-period boundary (file and line)" 2 no defect boundary
