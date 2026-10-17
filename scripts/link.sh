#!/bin/sh
# Link this clone's skills and agents into each agent harness, so `git pull` here updates all of them.
# Idempotent. Never overwrites a real folder: it reports it and moves on.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)

case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS="${MSYS:+$MSYS }winsymlinks:nativestrict"
    export CYGWIN="${CYGWIN:+$CYGWIN }winsymlinks:nativestrict"
    probe_dir=$(mktemp -d 2>/dev/null || mktemp -d -t dzstack-link)
    if ! ln -s "$here/README.md" "$probe_dir/probe" 2>/dev/null || [ ! -L "$probe_dir/probe" ]; then
      rm -rf "$probe_dir"
      echo "error: native symlinks unavailable on Windows Git Bash." >&2
      echo "fix: enable Windows Developer Mode (Settings -> System -> For developers) or run an elevated shell, then re-run scripts/link.sh." >&2
      exit 1
    fi
    rm -rf "$probe_dir"
    ;;
esac

skipped=0
link() { # source target
  if [ -L "$2" ]; then
    ln -sfn "$1" "$2"
  elif [ -e "$2" ]; then
    echo "skip (not a link, left alone): $2"
    skipped=$((skipped + 1))
  else
    ln -s "$1" "$2"
  fi
}

skill_dirs="$HOME/.claude/skills $HOME/.agents/skills"
[ -d "$HOME/.cursor" ] && skill_dirs="$skill_dirs $HOME/.cursor/skills"

for dir in $skill_dirs; do
  mkdir -p "$dir"
  for s in "$here"/skills/*/; do link "${s%/}" "$dir/$(basename "$s")"; done
done

mkdir -p "$HOME/.claude/agents"
for a in "$here"/agents/*.md; do link "$a" "$HOME/.claude/agents/$(basename "$a")"; done

# Prune broken symlinks (e.g. a skill renamed or deleted here)
for dir in $skill_dirs "$HOME/.claude/agents"; do
  for l in "$dir"/*; do [ -L "$l" ] && [ ! -e "$l" ] && rm "$l" && echo "removed stale link: $l"; done
done

skill_count=$(ls -d "$here"/skills/*/ | wc -l | tr -d ' ')
agent_count=$(ls "$here"/agents/*.md | wc -l | tr -d ' ')
if [ "$skipped" -gt 0 ]; then
  echo "linked $skill_count skills and $agent_count agents ($skipped existing non-symlink paths skipped)"
else
  echo "linked $skill_count skills and $agent_count agents"
fi
