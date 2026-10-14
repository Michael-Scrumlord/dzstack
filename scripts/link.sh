#!/bin/sh
# Link this clone's skills and agents into each agent harness, so `git pull` here updates all of them.
# Idempotent. Never overwrites a real folder: it reports it and moves on.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
link() { # source target
  if [ -L "$2" ]; then ln -sfn "$1" "$2"
  elif [ -e "$2" ]; then echo "skip (not a link, left alone): $2"
  else ln -s "$1" "$2"; fi
}
for dir in "$HOME/.claude/skills" "$HOME/.agents/skills"; do  # Claude Code; Codex, Antigravity, OpenCode
  mkdir -p "$dir"
  for s in "$here"/skills/*/; do link "${s%/}" "$dir/$(basename "$s")"; done
done
mkdir -p "$HOME/.claude/agents"
for a in "$here"/agents/*.md; do link "$a" "$HOME/.claude/agents/$(basename "$a")"; done
# links whose target is gone (a skill renamed or deleted here)
for dir in "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.claude/agents"; do
  for l in "$dir"/*; do [ -L "$l" ] && [ ! -e "$l" ] && rm "$l" && echo "removed stale link: $l"; done
done
echo "linked $(ls -d "$here"/skills/*/ | wc -l | tr -d ' ') skills and $(ls "$here"/agents/*.md | wc -l | tr -d ' ') agents"
