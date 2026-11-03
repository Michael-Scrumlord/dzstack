### Feature Playbook

You own the design. Delegate only when the work splits into disjoint files.

1. **Read the callers.** Trace the affected subsystem and the modules that consume it before deciding anything.
2. **Contract first.** Settle signatures and types before logic. Name the data shape (**principle-model-the-domain**): a state machine, discriminated union or typed record, not boolean flags.
3. **Plan, when it spans modules.** Note blocking first steps (types, migrations), independent workstreams, and shared mutable state to remove.
4. **Build lean.** Follow the code rules in daz-mode. Prefer the standard library and existing utilities over new packages. Commit in small, verifiable units.
5. **UI work: the five states.** Prove each on the rendered surface:
   1. Default, with data.
   2. Loading, with fixed geometry.
   3. Empty, with a call to action.
   4. Error, with a retry.
   5. Stress: long text, narrow viewport.
6. **Verify.** Behavior tests per **principle-test-behavior-not-implementation**, with one negative or boundary case, failing if the code returns `undefined`. Run the project's typecheck and lint. Show runtime output.

**Reply:** what was built and its interface, the data model and rejected alternatives, UI-state evidence if any, runtime proof.
