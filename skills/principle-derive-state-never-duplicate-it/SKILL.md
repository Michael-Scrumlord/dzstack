---
name: principle-derive-state-never-duplicate-it
description: "Apply when designing stateful systems, caches or UI stores. Keep one source of truth and compute everything else from it; a second copy of the same fact drifts."
disable-model-invocation: true
---

# Derive State, Never Duplicate It

Store each fact once. Compute the rest when it is read.

**Why:** Two copies of one fact must be kept in step by every writer, forever. One writer forgets, and the copies disagree in a way no test of either copy catches. Derived values cannot disagree with their source.

**The pattern:**
- Name the source of truth for each fact before writing the store
- Totals, counts, flags such as "is overdue" and filtered lists are functions of the source, not fields beside it
- Memoize a derivation when measurement shows it is slow; do not store it
- A cache is allowed only with an owner, an invalidation rule and a test that the cache equals the derivation
- In UI state, keep the server's data and the user's input; derive everything shown from those two
