### Refactoring Playbook

The structure changes. The behavior does not. A bug or missing feature found on the way becomes its own task. Large or cross-cutting migrations go to **figure-it-out**.

1. **Pin the behavior.** Run the existing tests on the area. If they don't cover it, write a characterization test or output snapshot before touching structure (**principle-test-behavior-not-implementation**). A typecheck is not a pin.
2. **Record the line count.** `wc -l` the files you will touch, or note `git diff --shortstat` at zero.
3. **Name the target shape.** The structure the code is missing (**principle-model-the-domain**), built as if from day one (**principle-redesign-from-first-principles**). It must delete branches, invalid states or data paths, not add indirection.
4. **Subtract first.** Delete dead code and redundant checks, and inline one-caller wrappers (**principle-subtract-before-you-add**). A shared helper must replace more lines than it adds. Ten similar lines can beat a helper with three parameters.
5. **Move in small steps.** For an API reshape, migrate every caller and delete the old API in the same change (**principle-migrate-callers-then-delete-legacy-apis**). No shims.
6. **Prove equivalence.** The pin passes, plus typecheck and lint.
7. **Count again.** Compare with step 2. If lines grew, rework until they shrink. If growth stays, it must buy something named, such as a new type that removes a class of invalid states, and the reply says so. If the result is not easier to trace (**principle-minimize-reader-load**), revert.

**Reply:** what was reshaped, the pin that held, lines before and after, what was reverted.
