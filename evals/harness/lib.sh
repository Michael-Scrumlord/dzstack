# Helpers for a case's check.sh. Sourced inside the eval image after the agent
# has finished. Read-only mounts: /work (the agent's result), /orig (the fixture
# as the agent first saw it), /hidden (the case's hidden files), /meta (what the
# harness measured: changed.txt has "<status>\t<path>" per changed file).
# Each check prints one JSON line; the harness scores the lines.
#
#   check <name> <weight> <required:yes|no> <command...>
#       Passes when the command exits 0. Output tail goes into "detail".
#   added_files <grep -E pattern>      files the agent added or modified
#   work_copy / orig_copy              print a fresh writable copy of /work or /orig
#   same_as_orig <path...>             exits 0 when those paths are unchanged
# shellcheck shell=bash

check() {
	local name=$1 weight=$2 required=$3
	shift 3
	local out rc
	out=$("$@" 2>&1)
	rc=$?
	jq -cn --arg name "$name" --argjson weight "$weight" --arg req "$required" \
		--argjson pass "$([ $rc -eq 0 ] && echo true || echo false)" \
		--arg detail "$(printf '%s' "$out" | tail -c 1500)" \
		'{name: $name, weight: $weight, required: ($req == "yes"), pass: $pass, detail: $detail}'
}

added_files() {
	awk -F'\t' '$1 ~ /^[AM]/ { print $2 }' /meta/changed.txt | grep -E "$1"
}

_copy_of() {
	local d
	d=$(mktemp -d)
	cp -a "$1/." "$d"
	echo "$d"
}
work_copy() { _copy_of /work; }
orig_copy() { _copy_of /orig; }

same_as_orig() {
	local p
	for p in "$@"; do
		diff -r -q "/orig/$p" "/work/$p" >/dev/null || return 1
	done
}
