#!/usr/bin/env bash
# A refactor must keep behavior exactly: hidden tests lock all three validators,
# including their documented differences. Also: the visible suite, the public
# surface, the copy-pasted patterns written once, and the code getting smaller.
source /harness/lib.sh
w=$(work_copy)

hidden() { cp /hidden/validators.hidden.test.ts "$w/test/" && cd "$w" && node --test test/validators.hidden.test.ts; }
check "hidden tests: behavior unchanged, differences included" 4 yes hidden

visible() { cd "$w" && rm -f test/validators.hidden.test.ts && node --test; }
check "the project's own tests pass" 1 yes visible

exports_same() { cd "$w" && node /hidden/exports.mjs; }
check "exported names and signatures are unchanged" 2 yes exports_same

rules_once() { cd "$w" && node /hidden/rules-once.mjs; }
check "the shared rules are written once (no pattern appears twice)" 2 yes rules_once

# Lines of code (no blanks, no comments) under src/, not counting routes.ts, which the task doesn't touch.
loc() { find "$1/src" -name '*.ts' ! -name routes.ts -print0 | xargs -0 cat | awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|\/\*|\*)/' | wc -l; }
shrinks() {
	local before after
	before=$(loc /orig)
	after=$(loc "$w")
	echo "code lines: $before -> $after"
	[ $((after * 100)) -le $((before * 80)) ]
}
check "the validators' code shrank by at least 20%" 1 no shrinks
