---
name: no-comments
description: Purge narrative code comments, banners, and workaround sermons. Enforces self-documenting code and preserves educational architectural pattern tags. Use for /no-comments or before code reviews.
disable-model-invocation: true
---

# No comments

Audit code to eliminate comment noise, enforce self-documenting code, and preserve educational design pattern tags.

---

## Scope

Analyze the caller's specified files or diff against the base branch (default `main`).

---

## Execution Steps

1. **Invoke Comment Sicko.**
   - Run the Comment Sicko subagent (or execute its prompt from [`references/comment-sicko.md`](references/comment-sicko.md) over the target files).
   - Comment Sicko deletes narrative play-by-play comments, strips unjustified lint/type suppressions, and flags internal workarounds as `MUST KILL`.

2. **Inspect the Audit Report.**
   - Verify deletions against the five narrow exceptions defined in [`references/comment-sicko.md`](references/comment-sicko.md) (legal headers, external vendor/OS quirks, public API docstrings, issue/RFC links, and root-level `// Pattern: <Canonical Name> - <1-line rationale>` tags).
   - If an internal workaround comment or type suppression was stripped and marked `MUST KILL`, **do not restore the comment**. Refactor the underlying code instead.

3. **Refactor `MUST KILL` Targets.**
   - For simple issues: delete dead branches, remove unused parameters, or inline trivial single-caller helpers (**principle-minimize-reader-load**).
   - For complex workarounds: settle the types or domain models so the behavior is obvious from the code itself (**principle-model-the-domain**, **principle-type-system-discipline**).
   - Never bolt on symptom guards (`if (!foo) return;`) to silence crashes. Fix the root cause (**principle-fix-root-causes**).

4. **Educational Pattern Callout.**
   - If canonical design pattern tags were created or preserved, summarize them in your reply to accelerate engineering pattern recognition.

---

### Output Format

Reply with high information density:
- **Comments deleted:** Total count of narrative comments and corpses removed.
- **MUST KILL refactors completed:** List of symbols refactored to eliminate workaround comments.
- **Patterns preserved (for learning):**
  - **Pattern:** Name of the pattern and target file.
  - **Why chosen:** The architectural benefit (e.g. eliminating branching conditionals, decoupling storage).
