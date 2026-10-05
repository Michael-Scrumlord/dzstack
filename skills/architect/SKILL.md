---
name: architect
description: "Sketch types, function signatures, and module boundaries before writing code. Single-model exploration by default with opt-in arena bake-offs. Use for /architect, 'architect this', 'design this', or non-trivial interface changes."
disable-model-invocation: true
---

# Architect

Design before implementing. Sketch types, function signatures, class shapes, and module boundaries with `not implemented` bodies or pseudocode *before* writing logic. If implementation proves the sketch wrong, throw it out and redesign from first principles.

---

## The Workflow

### 1. Ground the Problem
- Trace the relevant subsystems before sketching. Read consuming call sites and data contracts.
- Understand what the callers expect, not what you assume they want.

### 2. Sketch the Interface (Single-Model by Default)
- By default, use your configured `architect` model to draft the interface contract cleanly.
- Multi-model bake-offs via `/arena` are **strictly opt-in** (`/architect arena`) for high-consequence, irreversible decisions to conserve tokens and support single-provider harnesses like Claude Code.
- Require at least two structurally distinct interface candidates before settling on one (**principle-exhaust-the-design-space**).
- **Interface Depth Rule:** Prefer the design that hides the most complexity behind the smallest, simplest public surface. Deep modules > shallow wrappers.
- **Red Flag Filter:** Screen against [`references/design-red-flags.md`](references/design-red-flags.md): reject shallow modules, information leakage, temporal decomposition, and pass-through wrappers.

### 3. Checkpoint (Opt-In)
- Default: proceed directly to implementation with the chosen sketch.
- If the operator asked to "stop and show me before implementing", display the interface sketch and wait for confirmation.

### 4. Implement Against the Sketch
- Replace `not implemented` bodies with real logic. The settled sketch is the contract.
- Deviations from the sketch are high-signal: if a function needs an unexpected parameter, pause and question whether the sketch was flawed or the implementation is overreaching.

### 5. Scrap When the Architecture Is Wrong
If implementation creates continuous friction that the sketch cannot absorb, **scrap the sketch**. Do not bolt hacky workarounds onto a flawed foundation (**principle-redesign-from-first-principles**).
Tells that an architecture should be scrapped:
- Workarounds appearing across unrelated code.
- Escape hatches (`any`, forced type casts, ungrounded null-checks).
- Callers needing to understand internal private rules to use the public API.

---

### Output Format

Reply with high information density:
- **Caller usage sketch:** How consuming code calls the new interface.
- **Types & signatures:** Complete TypeScript/interface definitions with `not implemented` stubs.
- **Rejected alternatives:** 1-2 sentence rationale explaining why alternative shapes were rejected.
