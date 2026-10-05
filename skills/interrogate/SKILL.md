---
name: interrogate
description: "Adversarial code review. Challenges diffs from a contrarian engineering angle using a single deep model or multiple smaller models. Use for /interrogate, 'adversarial review', 'stress test this diff', or before merging high-stakes changes."
disable-model-invocation: true
---

# Interrogate

Adversarial code review. Rather than providing cheerful approval, interrogate actively searches for bugs, race conditions, edge-case regressions, and code bloat before changes reach production.

---

## Execution Modes (Harness Flexible)

To support single-provider harnesses (like Claude Code) while enabling cross-model consensus when available, interrogate supports two execution modes:

### Mode 1: Single-Model Contrarian Review (Default in Claude Code)
- Executes using your configured `reviewer` model (or the active chat model if only one provider is available).
- Adopts an uncompromising, senior adversarial persona:
  *"Assume the author overlooked subtle race conditions, error states, and dependency bloat. Your goal is to identify how this diff could break in production."*

### Mode 2: Multi-Model Review (Fast/Smaller Models or Diverse Families)
- When multiple models are configured in `setup-dzstack`, spawns 2 to 3 reviewers (e.g. using fast, lightweight models like Flash-Lite, Haiku, or mini tiers, or distinct model families).
- Each reviewer receives the identical diff and review rubric ([`references/rubric.md`](references/rubric.md)).
- Findings raised independently by multiple models are treated as high-signal consensus.

---

## Execution Steps

1. **Package Scope & Intent.**
   - Capture the current changeset (`git diff main...HEAD` or target file diff).
   - State the intent in one short paragraph (what the code is attempting to achieve).

2. **Execute Review Pass.**
   - Review through the lenses in [`references/rubric.md`](references/rubric.md):
     1. Correctness (edge cases, concurrency, error swallowing)
     2. Root Causes vs. Symptoms (no band-aids)
     3. Structural Integrity & Anti-Bloat (no single-caller wrappers, zero dependency inflation)
     4. Verification (proof on real artifact)
     5. Security (sanitization, auth bypasses)

3. **Lead Judgment (Pragmatic Senior Engineer).**
   Categorize all findings into four explicit buckets:
   - **Act On:** High-severity issues affecting correctness, security, or data integrity. These block merging.
   - **Consider:** Legitimate architectural improvements or cleaner patterns, weighted against immediate effort.
   - **Noted:** Technically valid observations that are low-impact or premature optimization.
   - **Dismissed:** Nitpicks, incorrect assumptions, or stylistic noise. State a one-line reason why dismissed.

---

### Output Format

Reply with high information density (no conversational fluff):
- **Stated intent:** 1-sentence summary of the reviewed change.
- **Review mode:** `[Single Model: <model>]` or `[Multi-Model: <models>]`.
- **Act On:** Priority issues to fix before merge (with file lines and failure mechanism).
- **Consider:** Architectural trade-offs worth evaluating.
- **Dismissed:** Rejected nitpicks with brief rationale.
- **Verdict:** `READY TO MERGE`, `NEEDS FIXES`, or `BLOCKED`.
