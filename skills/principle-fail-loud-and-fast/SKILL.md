---
name: principle-fail-loud-and-fast
description: "Apply when writing error handling, API boundaries or fallbacks. Surface failures where they happen with full context; never swallow an exception or substitute a silent default."
disable-model-invocation: true
---

# Fail Loud and Fast

A failure hidden at its source becomes a mystery three layers later.

**Why:** Empty catch blocks, default values on error and silent retries turn one clear failure into wrong data that travels. The cheapest moment to understand a failure is the moment it happens, with its inputs in hand.

**The pattern:**
- Validate at the boundary and reject bad input with a message that names the field and the value
- Never `catch {}` or log-and-continue unless the caller can act on the absence, and say so in the code
- Errors carry context: what was attempted, with which identifiers, and the underlying cause
- A fallback is a product decision, made visible to the user ("shown as entered; no rate"), never a hidden default
- Crash the job, not the system: fail the unit of work and report it, then keep serving others
- Pair with **principle-boundary-discipline**: guards at the edges, trust inside
