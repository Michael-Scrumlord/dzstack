### Feature Playbook

**You own the design. Plan, review, verify.** Delegate implementation to subagents only when necessary, and stay in the lead.

---

### Execution Steps

1. **Context Forensics.**
   - Trace the affected subsystem to understand existing patterns, call sites, and data flow.
   - Do not guess caller expectations. Read the consuming modules first.

2. **Architecture & Contract Definition.**
   - Settle interface boundaries, function signatures, and type definitions *before* writing logic.
   - Single-agent design exploration by default. Multi-model architectural fan-out is strictly opt-in for high-consequence, irreversible decisions.

3. **Throughput Checkpoint.**
   Write a four-item planning checkpoint before touching code:
   - **Blocking first steps:** Core types, schema migrations, or scaffold prerequisites.
   - **Independent workstreams:** Disjoint files or modules that can be implemented cleanly without overlapping writes.
   - **Shared mutable state:** Eliminate shared state; default to isolated structures before introducing synchronization.
   - **Smallest safe decomposition:** Smallest cohesive batch of changes that can be independently verified.

4. **Scoped Implementation & Anti-Bloat Guardrails.**
   - **Name the data shape first:** Model the domain using state machines, discriminated unions, or typed records per **principle-model-the-domain** instead of sprawling boolean flags.
   - **Enforce Anti-Bloat & Complexity Caps:**
     - *Hard structural limits:* Keep functions $\le 50$ LoC with $\le 3$ levels of indentation. Split modules exceeding $\sim 400$ LoC along clear domain boundaries.
     - *Zero boolean flag traps:* Never add boolean parameters that split a function into two behaviors; use explicit options or separate functions.
     - *Zero unvalidated casts:* Validate external data at the boundary; never silence the compiler with `as any` or `as unknown as T`.
     - *Zero single-caller wrappers:* Inline one-off helper functions. Keep call hierarchies flat.
     - *Zero dependency inflation:* Prefer standard library and existing project utilities over new external packages.
     - *Purge comment narration:* Keep comments only for non-obvious platform/vendor constraints.
     - *Educational Pattern Documentation:* When introducing a structural design pattern, document it with a single-line tag: `// Pattern: <Canonical Name> - <1-line rationale>`.
   - **Commit in atomic, verifiable units:** Stage small, logically cohesive commits. Do not litter git history with messy WIP commits that trigger redundant CI runs.

5. **Mandatory UI/UX Verification (For Frontend Features).**
   If the feature touches user interface or styling, verify the **5 Mandatory States** on the rendered surface:
   1. *Default State:* Standard view with populated data.
   2. *Loading State:* Layout-stable skeleton or indicator (zero cumulative layout shift).
   3. *Empty State:* Helpful guidance and actionable call-to-action when data is absent.
   4. *Error State:* Human-readable error recovery with a retry action.
   5. *Stress/Overflow State:* Verified against long text strings, narrow mobile viewports, and edge bounds.

6. **Targeted Verification & Static Hygiene Gate.**
   - Write behavior-pinning tests per **principle-test-behavior-not-implementation**: include at least one negative/boundary case and verify each test fails if the implementation returns `undefined` or no-ops.
   - Run full-repo strict typecheck (including test files) and unused-symbol checks (`--noUnusedLocals --noUnusedParameters`) with zero errors.
   - Prove the new capability works with runtime output. "It compiles" is not completion.

7. **Clean Delivery.**
   - Rebase into clean, conventional commits.

---

### Output Format

Reply with high information density:
- **What was built:** The new capability and its public interface.
- **Data model:** The core types or state machine chosen, and why alternative shapes were rejected (use a markdown comparison table if multiple designs were considered).
- **UI/UX verification:** Evidence of all five UI states verified (if frontend).
- **Runtime proof:** Terminal or test output proving the feature executes as intended.
