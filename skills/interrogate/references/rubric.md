# Review Rubric

Review changes through these critical lenses.

## 1. Correctness
- Edge cases: empty inputs, null/undefined, boundary values, concurrent mutations.
- Error handling: are exceptions handled or silently swallowed (**principle-fail-loud-and-fast**)?
- Race conditions, stale closures, unhandled promise rejections.
- Idempotency: what happens if the operation runs twice or crashes midway (**principle-make-operations-idempotent**)?

## 2. Root Causes vs. Symptoms
- Does the code fix the underlying architectural flaw or paper over a symptom (**principle-fix-root-causes**)?
- Reject defensive null-checks that mask deeper invariant violations.
- Reject retry logic that conceals broken API contracts.

## 3. Structural Integrity & Anti-Bloat
- **Complexity & nesting cap:** Flag functions exceeding ~50 LoC or 3 levels of control-flow nesting that should be flattened via guard clauses, lookup tables, or pure helpers.
- **Module size & cohesion:** Flag files exceeding ~400 LoC that mix unrelated responsibilities or temporal stages.
- **Boundary & type discipline:** Validate at system edges; keep internal logic pure (**principle-boundary-discipline**). Flag unvalidated `as` casts, lying type guards, and boolean flag parameter traps (`fn(x, true, false)`).
- **Single-caller wrappers:** Flag one-off pass-through helpers that add layers without hiding complexity (**principle-minimize-reader-load**).
- **Zero dependency inflation:** Flag new external dependencies where standard library or 10 lines of code suffice (**principle-zero-dependency-inflation**).
- **Dead-code hygiene:** Flag unused exports, orphaned types, and compatibility shims left behind after migrating callers (**principle-migrate-callers-then-delete-legacy-apis**).

## 4. Verification
- Does the PR verify the real runtime artifact, or merely rely on "it compiles" (**principle-prove-it-works**)?
- **Undefined-return mutation check:** Would the new tests still pass if every imported function returned `undefined` (**principle-test-behavior-not-implementation**)? Flag weak assertions (`toBeDefined`, mock-only checks, self-referential assertions) and missing negative/boundary test cases.
- Did strict typechecking (including test files) and unused-symbol checks pass?

## 5. Security
- Unsanitized inputs flowing to dangerous sinks (SQL, shell, eval, innerHTML).
- Authentication or authorization bypasses in modified paths.
- Secrets or PII exposed in logs or client-facing responses.
