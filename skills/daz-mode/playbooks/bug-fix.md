### Bug Fix Playbook

**You own this task. Plan, review, verify.** Delegate implementation to subagents only when necessary, and stay in the lead.

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders code that "might help" is a hypothesis, not a fix; it does not ship. When evidence refutes a hypothesis, revert the changes immediately. The smallest change that runtime evidence justifies ships: nothing more.

---

### Execution Steps

1. **Reproduce it yourself directly (Zero Loss of Rigor).**
   - Do not ask the user to verify or reproduce the issue.
   - **Project with existing test suite:** Add a permanent regression test directly to the test suite that fails under current conditions.
   - **Project without test suite (or heavy suite):** Write an isolated, deterministic reproduction script (e.g., `repro.ts`, `repro.py`, or curl command) with strict assertions that exits with a non-zero code on failure. This ensures 100% test rigor without token-expensive suite runs.
   - **UI/Visual defect:** Drive the rendered surface (headless browser, Playwright, or screenshot) to capture and assert the broken visual state.

2. **Sequential, token-conscious forensics.**
   - Do not spawn parallel subagents to investigate the same context.
   - Run a single-pass sequential investigation:
     1. Trace the execution path through affected code.
     2. Inspect recent git blame/commit history on those lines to identify regression triggers.
   - Formulate candidate hypotheses. Eliminate them one by one using targeted runtime logs or execution assertions. Do not guess.

3. **Plan and implement the minimal fix.**
   - If the fix crosses module boundaries, settle the interface and type contracts first.
   - Delegate implementation to your configured code model with an explicit, narrow file scope, or apply the surgical edit directly.
   - Review the diff: ensure zero single-caller wrappers, no unnecessary comments, and negative/minimal lines of code.

4. **Verify on the exact same surface.**
   - Re-run the reproduction test or script from Step 1. The original repro must now pass cleanly (exit code 0).
   - For UI defects, re-inspect the rendered element to confirm layout geometry, focus, and styling match expectations.
   - "It compiles" or "CI passed" is not proof of bug absence. Only the passing repro script is proof.

5. **Clean git history.**
   - Stage the changes cleanly. Commit the failing test/repro first, followed by the fix commit.

---

### Output Format

Reply with high information density (no conversational fluff):
- **Broken symptom:** What failed and under what condition `[observed]`.
- **Root cause:** The exact mechanism that caused the failure `[measured]`.
- **Fix:** The minimal architectural change applied.
- **Verification evidence:** Verbatim terminal output showing the failing repro transitioning to passing.
