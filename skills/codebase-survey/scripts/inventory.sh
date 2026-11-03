#!/usr/bin/env bash
# Phase 1 of a codebase survey, from git alone: languages and lines, the largest
# files, churn, hotspots (churn x lines), files that change together, and how
# many people touched each hotspot. Read-only. Prints Markdown.
#
# Usage: inventory.sh <repo> [--since "<git date>"] [--top <n>]
#   --since  churn window, default "12 months ago"
#   --top    rows per table, default 15
# Excludes lockfiles, minified files, vendored and generated folders.
set -u

repo=${1:-}
[ -n "$repo" ] && [ -d "$repo" ] || { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
shift
since="12 months ago" top=15
while [ $# -gt 0 ]; do
	case "$1" in
	--since) since=${2:?--since needs a date}; shift 2 ;;
	--top) top=${2:?--top needs a number}; shift 2 ;;
	*) echo "unknown option $1" >&2; exit 2 ;;
	esac
done
cd "$repo" || exit 1
git rev-parse --git-dir >/dev/null 2>&1 || { echo "$repo is not a git repository" >&2; exit 1; }

skip='(^|/)(node_modules|vendor|third_party|dist|build|out|target|coverage|\.next|__pycache__|\.venv|venv)/|(\.min\.(js|css)|\.map|\.lock|-lock\.json|\.snap|\.svg|\.png|\.jpe?g|\.gif|\.ico|\.pdf|\.woff2?|\.ttf|\.zip|\.gz)$|(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock)$'
# Prose and data files count in Languages, but churn, hotspots and coupling are about code.
notcode='\.(md|markdown|rst|txt|adoc|json|ya?ml|toml|ini|cfg|csv|tsv)$'
tab=$(printf '\t')
# "  12 a path" (uniq -c) to "12<TAB>a path", keeping spaces inside the path
counted() { sed -E "s/^ *([0-9]+) /\\1$tab/"; }
# file names changed per commit, one "@@" line before each commit's files
changes() { git log --no-merges --since="$since" --format='tformat:@@' --name-only; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git ls-files -z | tr '\0' '\n' | grep -Ev "$skip" >"$tmp/files"
# lines per file; binary files skipped (grep -I treats them as non-matching)
while IFS= read -r f; do
	[ -f "$f" ] || continue
	grep -Iq . "$f" 2>/dev/null || continue
	printf '%s\t%s\n' "$(wc -l <"$f" | tr -d ' ')" "$f"
done <"$tmp/files" >"$tmp/lines"
grep -Ev "$notcode" "$tmp/lines" >"$tmp/code" || true

echo "# Inventory"
echo
echo "Commit \`$(git rev-parse --short HEAD)\` ($(git log -1 --format=%cs)). $(wc -l <"$tmp/lines" | tr -d ' ') text files, $(awk -F'\t' '{s+=$1} END {print s+0}' "$tmp/lines") lines, after excluding vendored, generated and lock files. Churn window: since $since. Churn, hotspots and coupling count code files only."
echo

echo "## Languages"
echo
echo "| Extension | Files | Lines |"
echo "|---|---|---|"
awk -F'\t' '{ n=$2; sub(/.*\//, "", n); e = (n ~ /\./) ? n : "(none)"; sub(/.*\./, ".", e); f[e]++; l[e]+=$1 }
	END { for (e in f) printf "%d\t%d\t%s\n", l[e], f[e], e }' "$tmp/lines" | sort -rn | head -n "$top" |
	awk -F'\t' '{ printf "| `%s` | %d | %d |\n", $3, $2, $1 }'
echo

echo "## Largest code files"
echo
echo "| Lines | File |"
echo "|---|---|"
sort -rn "$tmp/code" | head -n "$top" | awk -F'\t' '{ printf "| %d | `%s` |\n", $1, $2 }'
echo

# churn: commits touching each code file still present, inside the window, merges excluded
changes | awk 'NF && $0 != "@@"' | sort | uniq -c | counted >"$tmp/churn"
awk -F'\t' 'NR==FNR { keep[$2]=$1; next } ($2 in keep) { print $1 "\t" $2 "\t" keep[$2] }' "$tmp/code" "$tmp/churn" >"$tmp/both"

echo "## Churn (commits since $since)"
echo
echo "| Commits | Lines | File |"
echo "|---|---|---|"
sort -rn "$tmp/both" | head -n "$top" | awk -F'\t' '{ printf "| %d | %d | `%s` |\n", $1, $3, $2 }'
echo

echo "## Hotspots (commits x lines)"
echo
echo "Files that are both large and often changed. Defects cluster here; read these first. Swap lines for a complexity score once phase 4 has one."
echo
echo "| Score | Commits | Lines | Authors | File |"
echo "|---|---|---|---|---|"
awk -F'\t' '{ printf "%d\t%s\t%s\t%s\n", $1 * $3, $1, $3, $2 }' "$tmp/both" | sort -rn | head -n "$top" >"$tmp/hot"
while IFS="$tab" read -r score commits lines file; do
	authors=$(git log --no-merges --since="$since" --format=%ae -- "$file" | sort -u | wc -l | tr -d ' ')
	printf '| %s | %s | %s | %s | `%s` |\n' "$score" "$commits" "$lines" "$authors" "$file"
done <"$tmp/hot"
echo

echo "## Files that change together"
echo
echo "Code files changed in the same commit at least 3 times (commits touching more than 20 files are skipped as sweeping). A pair in different modules is hidden coupling: one change needs the other. A file and its own test is expected."
echo
echo "| Together | File A | File B |"
echo "|---|---|---|"
changes | awk -v skip="$skip" -v notcode="$notcode" '
		function flush(   i, j) { if (n >= 2 && n <= 20) for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) print (f[i] < f[j]) ? f[i] "\t" f[j] : f[j] "\t" f[i]; n = 0 }
		$0 == "@@" { flush(); next }
		NF && $0 !~ skip && $0 !~ notcode { f[++n] = $0 }
		END { flush() }' |
	sort | uniq -c | counted | awk -F'\t' '$1 >= 3' | sort -rn | head -n "$top" |
	awk -F'\t' '{ printf "| %d | `%s` | `%s` |\n", $1, $2, $3 }'
