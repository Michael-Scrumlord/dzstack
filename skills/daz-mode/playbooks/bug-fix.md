### Bug Fix Playbook

Every shipped line traces to evidence. Code that "might help" is a hypothesis, not a fix. Revert anything the evidence refutes.

1. **Reproduce.** Add a regression test to the suite that fails on the current code and asserts the observable result (**principle-test-behavior-not-implementation**). No usable suite: a small repro script that exits non-zero on failure. UI defect: assert on the rendered surface.
2. **Find the cause.** Trace the path through the affected code. Check `git log` or blame on those lines only when the bug looks like a regression. Eliminate hypotheses with runs, not guesses.
3. **Fix minimally.** The smallest change the evidence justifies. Settle the interface first if the fix crosses modules.
4. **Verify.** The repro passes now and fails with the fix reverted. Run the project's typecheck and lint if it has them.

**Reply:** symptom, root cause, fix, and the repro going from fail to pass.
