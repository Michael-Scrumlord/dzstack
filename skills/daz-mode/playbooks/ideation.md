### Ideation & Product Strategy Playbook

**You own the product vision, feasibility analysis, and execution roadmap.** Guide the operator from raw concept to a rigorous, actionable architecture.

Do not write implementation code in this playbook. Your deliverable is an executive product brief, technical feasibility analysis, and phased execution roadmap.

---

### Execution Steps

1. **Problem Definition & Market Angle (The "Why").**
   - **Target Persona:** Who specifically experiences the friction (end user, internal developer, ops engineer)?
   - **Core Pain Point:** What is inefficient, broken, or missing in current workflows?
   - **Current Workarounds:** How is this solved today (manual duct-tape, bloated third-party tools, brittle scripts)?
   - **Value Proposition:** What makes this feature worth its permanent maintenance footprint?

2. **Technical Feasibility & Boundary Sizing (The "How").**
   - **Domain Modeling:** Identify the foundational data shapes, types, and state machines required (**principle-model-the-domain**).
   - **Integration Touchpoints:** Which internal modules, databases, or APIs must be modified?
   - **Dependency Audit:** Can this be built using existing project primitives and the standard library (**principle-zero-dependency-inflation**)?
   - **Critical Failure Modes:** What could go wrong (concurrency deadlocks, rate limits, schema migration risks, performance bottlenecks)?

3. **User Experience & Ruthless Scope Cutting (The "Delight").**
   - **The Core Loop:** What is the simplest, most intuitive interaction flow?
   - **The 5 UI States Preview (if frontend):** Outline the expected behavior for Default, Loading, Empty, Error, and Stress/Overflow states.
   - **What to Cut (Subtract Before You Add):** Explicitly define what will **NOT** be built in v1. Strip out bells and whistles, settings toggles, and speculative extensions. Focus on the core 20% that delivers 80% of user value.

4. **Phased Execution Roadmap (The "Path").**
   Break the feature down into small, independently verifiable phases that map directly to `dzstack` execution playbooks:
   - *Phase 1 (Scaffold & Types):* Foundational data structures, schemas, and contracts.
   - *Phase 2 (Core Logic):* Engine implementation, pure business functions, and backend services verified with deterministic tests.
   - *Phase 3 (Surface & UI):* Frontend components, CLI commands, or API endpoints verified against live rendered states.
   - *Phase 4 (Hardening & Polish):* Edge case validation, performance checks, and documentation.

---

### Output Format

Reply with high information density (no conversational fluff):

#### 1. Concept & Market Fit
- **Summary:** One-paragraph executive brief of the feature and its unique angle.
- **Target User & Friction:** Concrete explanation of who benefits and why.

#### 2. Technical Architecture & Constraints
- **Proposed Data Model:** Core types or state machine signatures.
- **Technical Risks & Mitigations:** Sized table of architectural bottlenecks and how to avoid them.

#### 3. Scope Boundaries
- **In-Scope (v1):** The absolute minimum required to deliver end-to-end delight.
- **Explicitly Out-of-Scope (Deferred):** Features intentionally rejected to prevent bloat.

#### 4. Phased Execution Roadmap
A markdown table ready for execution:

| Phase | Milestone | Deliverable | Target dzstack Playbook | Verification Gate |
|---|---|---|---|---|
| **Phase 1** | Types & Schemas | Domain models & migration scripts | `playbooks/feature.md` | Unit test / type check passes |
| **Phase 2** | Core Engine | Business logic & adapters | `playbooks/feature.md` | Deterministic integration test |
| **Phase 3** | UI & Surface | Interactive components & views | `playbooks/feature.md` | 5 UI states verified on live screen |
| **Phase 4** | Delivery | Final documentation & cleanup | `playbooks/shipping.md` | Clean PR with evidence log |
