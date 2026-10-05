---
name: arena
description: "Spawn N=3 parallel contestants at the same difficult task, pick the strongest base, and graft the best ideas into it. Use for /arena, 'arena this', or when a single attempt risks locking in a flawed shape."
disable-model-invocation: true
---

# Arena

Spawn $N=3$ parallel attempts at the same difficult implementation task with minimal context overlap. Evaluate all candidates, pick the strongest base, graft the best ideas from the alternatives, and verify the synthesized result.

---

## Execution Steps

### 1. Frame the Contest (Minimal Context Payload)
- Define the concrete artifact to produce (a function, module, or algorithm).
- **Minimal Context Overlap (Token Shield):** Do not dump the entire repository into contestants. Pass *only* the target interface contract, type signatures, and specific dependencies.
- Define a 3-point evaluation rubric based on correctness, simplicity, and interface depth.

### 2. Fan Out ($N=3$ Contestants)
- Spawn $N=3$ subagents in parallel using isolated workspaces (dedicated git worktrees via `git worktree add` or temporary isolated directories `/tmp/arena-<slug>/candidate-<n>/`) per **principle-separate-before-serializing-shared-state**.
- Contestants execute independently without reading each other's workspaces or transcripts.
- Each contestant outputs its implementation and a brief 2-sentence rationale of alternatives considered.

### 3. Cross-Judge Evaluation
- After all contestants finish, review all three candidates against the rubric.
- Score each candidate on:
  1. *Correctness & Invariant Safety*
  2. *Simplicity & Reader Load* (negative LoC bias)
  3. *Extensibility* (ease of maintenance without breaking invariants)

### 4. Pick the Base
- Choose the cleanest, most maintainable candidate as the foundational base.
- If two are tied, pick the candidate with fewer lines of code and shallower call hierarchies (**principle-laziness-protocol**).

### 5. Graft Strong Ideas
- Inspect the losing candidates for specific insights, edge-case protections, or performance tricks that the base candidate missed.
- Graft those specific ideas into the base implementation by hand (**principle-redesign-from-first-principles**). Do not paste blindly.
- Discard the rest of the losing candidates.

### 6. Verify Synthesized Artifact
- Run the deterministic verification test suite against the grafted result (**principle-prove-it-works**).
- Clean up temporary contestant worktrees/directories.

---

### Output Format

Reply with high information density:
- **Base selected:** Which candidate was picked as the foundation and why.
- **Grafted elements:** Specific ideas or edge-case handling ported from other candidates.
- **Discarded elements:** Rejected approaches and rationale.
- **Verification result:** Test or runtime proof of the final synthesized code.
