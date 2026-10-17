---
name: tdd
description: "Write a focused failing regression or behavior test before changing production code, verify RED to GREEN, and enforce behavior-driven assertions. Use for /tdd, bug fixes, or new domain logic."
disable-model-invocation: true
---

# TDD & Behavior-Driven Verification

Make the target behavior or broken invariant executable before changing production code. The goal is a fast, deterministic test that fails before the change (RED), passes after it (GREEN), and proves behavior against literal expected values.

---

## Workflow

1. **Understand the behavior or defect.** Identify the intended contract, current behavior, affected codepath, and smallest observable reproduction.
2. **Isolate pure decision logic when coupled (**principle-boundary-discipline**).**
   - Never use I/O, framework wiring, or UI coupling as an excuse to skip automated testing.
   - If the target path is tangled with network, database, or framework state, first extract the core decision/transformation into a pure function taking typed inputs and returning typed outputs, then test that pure function directly.
3. **Write the failing test first (RED).**
   - Add the smallest focused test that encodes the intended contract and at least one negative or boundary case.
   - **Undefined-return mutation check (**principle-test-behavior-not-implementation**):** Ask whether the test would still pass if every imported function returned `undefined`. Assert literal expected outputs or state transitions; never rely solely on `toBeDefined`, `not.toThrow`, or `toHaveBeenCalled`.
   - Run only the targeted test file or filter flag (e.g. `bun test path/to/test.ts -t "case"`) to conserve runner output tokens.
4. **Confirm RED for the right reason.** Run the test before editing production code and record the failure output labeled `[observed]`. If it passes or fails for an unrelated setup error, fix the test first.
5. **Implement with Negative LoC Bias (GREEN).** Make the smallest production change that satisfies the contract:
   - Keep functions $\le 50$ LoC and $\le 3$ nesting levels; inline single-caller wrappers; avoid boolean parameter traps and unvalidated `as` casts.
   - If a structural design pattern is introduced, document it with a standard educational tag: `// Pattern: <Canonical Name> - <1-line rationale>`.
6. **Rerun the test and static hygiene gate.**
   - Confirm the targeted test passes deterministically labeled `[measured]`.
   - Run strict typechecking (including test files) and unused-symbol checks (`--noUnusedLocals --noUnusedParameters`, `knip`, `ruff`).

---

## Guardrails

- Do not change tests merely to match a wrong implementation.
- Do not weaken existing assertions unless the expected contract genuinely changed and the reason is documented.
- Prefer real domain inputs over heavy mock scaffolding. Mock only external system boundaries that cannot run locally in memory.
- If a defect is purely visual/layout or requires a live external process that cannot be unit-tested even after pure-function extraction, write a deterministic reproduction script or Playwright/CDP check and explain why in one line.

---

## Final Response

Report the evidence, not just the outcome (no conversational filler):

- **Failing-before check (RED):** Exact command and failure output `[observed]`.
- **Passing-after check (GREEN):** Exact command, pass result, and runtime `[measured]`.
- **Code delta:** Production lines changed with LoC balance.
- **Static & nearby validation:** Typecheck, dead-code check, and adjacent test results.
