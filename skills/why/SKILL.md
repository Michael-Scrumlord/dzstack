---
name: why
description: "Use for 'why does X work this way', 'why was this chosen', design rationale, regressions, postmortems, or historical forensics. Anchors in Git history and queries available MCP sources. Use how for runtime behavior."
---

# Why

Investigate the motivation, history, and intent behind code. Companion to `how`: `how` explains what the code does; `why` uncovers the historical forces, bugs, and trade-offs that led to its current shape.

---

## Operating Posture

Operate as a careful, precise forensics investigator. Be rigorously honest about what is documented versus what is an educated guess. Follow the confidence tiers in [`references/epistemics.md`](references/epistemics.md).

---

## Execution Steps

### 1. Establish the Code Anchor (Git Archaeology)
Before searching external systems, anchor the investigation in the local Git record:
```bash
# Blame target lines to find the last-touch commits
git blame -L <start>,<end> <file>

# Trace full commit history across renames
git log --follow -p -n 10 -- <file>

# Inspect commit message and PR reference (#1234)
git log -1 --format=%B <commit>
```
If a pull request number is found, query its metadata and review discussions via `gh`:
```bash
gh pr view <pr-number> --json title,body,author,createdAt,mergedAt,comments
```

### 2. Discover Available External Sources (MCP Discovery)
Check for active Model Context Protocol (MCP) servers connected to your harness:
- **Issue Trackers:** Linear, Jira, GitHub Issues (product rationale).
- **Error Trackers:** Sentry, Bugsnag (exception logs that motivated defensive guards).
- **Team Communications:** Slack, Discord (discussions that never reached an RFC).
- **Observability:** Datadog, Honeycomb (timeouts, rate limits, performance incidents).

*Token Guardrail:* Execute searches sequentially within the primary agent using your configured `forensics` model. Do not spawn a fleet of parallel subagents unless sweeping massive external databases.

### 3. Synthesize with Epistemic Discipline
Classify every claim using the confidence tiers:
1. `[documented]`: Proven by contemporary commit messages, PR descriptions, or issue threads. Cite the SHA or PR.
2. `[inferred]`: Logically derived from code mechanics and invariants.
3. `[hypothesis]`: Plausible educated guess where records are silent.
4. `[unknown]`: Explicitly acknowledged evidence gaps.

If this investigation precedes modifying the code, synthesize a **Preserve / Change / Avoid / Risk** matrix to prevent accidental regressions.

---

### Output Format

Reply with high information density:
- **The question & target code:** What was investigated and where it lives.
- **What is documented:** Historical rationale backed by Git commits or PR discussions `[documented]`.
- **What is inferred:** Structural forces apparent from the architecture `[inferred]`.
- **Hypotheses & unknowns:** Unproven guesses and acknowledged evidence gaps.
- **Preserve vs. Change:** What invariants must be preserved if this code is modified.
