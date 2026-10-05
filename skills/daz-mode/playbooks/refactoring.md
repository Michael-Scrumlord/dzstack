### Refactoring Playbook

**You own the contract. The structure changes. The behavior does not.** Distinct from Feature, which adds behavior, and Bug fix, which corrects it.

If the cleanup reveals a missing feature or an existing bug, split it out into its own task and ship the structural change first against the pinned contract. A redesign is allowed, but name it and route to Feature. Large or cross-cutting structural migrations belong to the **figure-it-out** playbook. This playbook is for focused-to-medium structural improvements.

---

### Execution Steps

1. **Pin the behavior contract first (Deterministic Baseline).**
   - Run a targeted inspection over the affected subsystem to learn the contract.
   - Write a characterization test, output snapshot, or deterministic equivalence harness that captures current input-to-output behavior *before* touching any structure.
   - If the area has no test coverage, write the pin first. Type checks and linter passes are **not** a behavior pin.

2. **Name the missing structure.**
   - Name the structure the code is missing per **principle-model-the-domain**. Boring code stays when the shape is already clear and local.
   - The reshape must delete branches, eliminate invalid states, or simplify data flow—not add abstract indirection.

3. **Name the target shape.**
   - State what the module layout, types, and call graph should be if built cleanly today (**principle-foundational-thinking**, **principle-redesign-from-first-principles**).
   - If the target crosses a module boundary, settle the interface signatures before executing the move.

4. **Subtract before you add (Active Inlining & Dead Code Purge).**
   - Delete dead code, drop redundant validators, and remove orphaned references before introducing the new shape (**principle-subtract-before-you-add**).
   - **One-caller inlining:** Actively identify and inline single-caller wrapper functions to flatten call hierarchies.
   - The smallest change that reaches the target shape ships (**principle-laziness-protocol**). Speculative cleanups that "might help" are reverted immediately.

5. **Move in small, behavior-preserving steps.**
   - For API reshapes, migrate every caller and delete the old API in the exact same wave (**principle-migrate-callers-then-delete-legacy-apis**). No deprecated compatibility shims, no parallel old-and-new paths.
   - Spot-check every symbol rename across all consuming files.
   - Delegate mechanical edits to your configured code model with an explicit file scope and exact behavior to hold. Review the diff yourself.

6. **Prove deterministic equivalence on the real artifact.**
   - Run the characterization pin from Step 1 against the modified code (**principle-prove-it-works**).
   - Outputs must be 100% deterministically identical. Any behavior deviation or test failure requires an immediate revert of the offending change.
   - Do not trust a delegate's "looks good" summary; inspect the runtime proof yourself.

7. **The Reader-Load & Negative LoC Gate.**
   - The measure of success is reduced reader load (**principle-minimize-reader-load**) and a lean codebase.
   - **Negative LoC ($\Delta$ LoC) bias:** Calculate the line count delta. A refactor should simplify and shrink the codebase. If line count grew without new capabilities, justify why or revert.
   - If the diff does not make the code easier for a human to trace and maintain, revert it.

8. **Clean Delivery.**
   - Rebase into small, ordered commits: subtraction first, then the reshape, then follow-on cleanup (**principle-sequence-verifiable-units**).
   - Each commit must remain green and independently verifiable.

---

### Output Format

Reply with high information density:
- **Structure changed:** What modules, classes, or types were reshaped.
- **The pin held:** The characterization test or snapshot used to guarantee safety.
- **Deterministic equivalence proof:** Confirmation that old and new outputs match identically.
- **Metrics delta:** Net line count change ($\Delta$ LoC) and reader-load assessment.
- **What shipped vs. what was reverted:** Clean summary of kept changes and discarded dead ends.
