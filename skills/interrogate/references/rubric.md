# Review Rubric

Review changes through these critical lenses.

## 1. Correctness
- Edge cases: empty inputs, null/undefined, boundary values, concurrent mutations.
- Error handling: are exceptions handled or silently swallowed?
- Race conditions, stale closures, unhandled promise rejections.
- Idempotency: what happens if the operation runs twice or crashes midway?

## 2. Root Causes vs. Symptoms
- Does the code fix the underlying architectural flaw or paper over a symptom?
- Reject defensive null-checks that mask deeper invariant violations.
- Reject retry logic that conceals broken API contracts.

## 3. Structural Integrity & Anti-Bloat
- Boundary discipline: validate at system edges; keep internal logic pure.
- Single-caller wrappers: flag one-off helpers that add layers without hiding complexity.
- Zero dependency inflation: flag new external dependencies where standard library or 10 lines of code would suffice.
- Bolted-on vs. integrated: does the change feel cohesive, or bolted onto an existing design?

## 4. Verification
- Does the PR verify the real runtime artifact, or merely rely on "it compiles"?
- Is there an automated test or deterministic reproduction script proving bug absence or feature execution?

## 5. Security
- Unsanitized inputs flowing to dangerous sinks (SQL, shell, eval, innerHTML).
- Authentication or authorization bypasses in modified paths.
- Secrets or PII exposed in logs or client-facing responses.
