---
name: tdd
description: "Use only when the user explicitly asks for TDD, a failing test, or a regression test, OR when the bug has an obvious cheap local test target. Skip when the test path is unclear, expensive, integration-heavy, or not requested."
disable-model-invocation: true
---

# TDD Bug Fix

When fixing a bug with a clear, cheap test path, make the broken behavior executable before changing production code. The goal is a focused regression test that fails before the fix and passes after it.

Do not force a test when it would be impractical. If the available test would require broad harness setup, brittle mocks, slow end-to-end infrastructure, production-only state, vague reproduction steps, or large unrelated fixture churn, skip adding a new test and use the closest useful verification instead.

---

## Workflow

1. **Understand the bug.** Identify the intended behavior, current behavior, affected path, and smallest observable reproduction.
2. **Choose the narrowest executable check.** Prefer the closest unit, component, integration, or regression test already used for that codepath. If no practical test path is obvious, do not create one from scratch just to satisfy the workflow.
3. **Write the failing test first (RED).** Add the smallest focused test that would have caught the bug. The test should encode intended behavior, not mirror the current implementation. Run only the targeted test file or filter flag (e.g., `pnpm test path/to/test.ts -t "case"`) to conserve runner output tokens.
4. **Run the new test before fixing.** Confirm it fails for the intended reason. Record the failure output labeled `[observed]`. If it passes or fails for an unrelated reason, correct the test or reproduction before editing the implementation.
5. **Fix the bug (GREEN with Negative LOC bias).** Make the smallest production change that satisfies intended behavior while preserving nearby contracts.
   - Apply negative LoC bias: inline single-caller wrappers, eliminate dead branches, avoid adding unnecessary abstractions or utility bloat.
   - If a structural design pattern is introduced, document it with a standard educational tag: `// Pattern: <Canonical Name> - <1-line rationale>`.
6. **Rerun the regression test.** Confirm the test now passes cleanly labeled `[measured]`. Ensure deterministic equivalence across repeated runs.
7. **Run nearby validation.** Run relevant adjacent tests, type checks, lint, or scenario checks when the change has broader risk. Keep execution focused to avoid bloating agent context.

---

## If a Failing Test Is Impractical

Do not silently skip the regression step. Before fixing, explicitly explain why a failing test is impossible or not worth the cost, then choose the closest executable regression check available. Examples include a targeted script, manual reproduction command, browser automation, snapshot comparison, log assertion, or focused integration check.

Prefer no new test over a bad test. A bad test is one that mostly tests mocks, encodes current implementation details, depends on timing or unrelated global state, needs expensive infrastructure for a small fix, or would be deleted immediately after proving the fix.

---

## Guardrails

- Do not change tests merely to match a wrong implementation.
- Do not weaken existing assertions unless the expected behavior has genuinely changed and the reason is clear.
- Keep the regression test focused on the bug. Avoid broad fixture churn or unrelated coverage expansion.
- Do not add tests when the practical signal is weak. Use manual or scripted verification and say why.
- If the bug is flaky, make the test deterministic where possible and document the signal being locked down.
- If the bug exposes a broader class of failures, first land the focused regression path, then consider additional sibling coverage.

---

## Final Response

Report the evidence, not just the outcome (no conversational filler):

- **Failing-before test / executable check:** Exact command and failure output `[observed]`.
- **Passing-after test run:** Exact command, pass result, and runtime `[measured]`.
- **Code delta:** Production lines changed with negative LoC balance.
- **Nearby validation:** Adjacent tests or type checks executed.
- **Impracticality rationale (if applicable):** If failing-before evidence could not be demonstrated, state why and describe the closest regression check used instead.
