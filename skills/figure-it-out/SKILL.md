---
name: figure-it-out
description: "Design an auditable, bespoke playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work an operator reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and logs decisions. Use for /figure-it-out, 'figure it out', a large migration, or when no preset playbook applies."
disable-model-invocation: true
---

# Figure It Out

When the task matches no preset playbook, design one. The deliverable before writing code is the workflow itself: a sequence of phases that scales rigor to the task, executes the scientific method, and leaves an auditable decision trail. Bias toward more rigor. The cost of building the wrong thing dwarfs the cost of being careful.

---

## Initialization

Open a task checklist whose first item is to read the Principles section of the **Daz Mode** skill (`skills/daz-mode/SKILL.md`). Then add the phases below as concrete checklist items.

---

## Phase A: Frame

Ground first, then commit. Do not begin the run until you can state:

- **Definition of Done:** A falsifiable, testable predicate on the real artifact (**principle-prove-it-works**).
- **Quantified Scope & Token Budget:** Estimated files touched, execution units, and turn budget to prevent runaway agent loops (**principle-guard-the-context-window**).
- **Rigor Level:** Sized based on blast radius. High-stakes architectural changes and one-way doors get strict verification gates; low-stakes reversible edits get lean execution.

Present the framing and trade-offs before committing to an extended run. Reversible work proceeds (**principle-never-block-on-the-human**), but a multi-hour autonomous run earns an upfront scope checkpoint.

---

## Phase B: Design the Bespoke Workflow

Decompose the effort into atomic, independently reviewable units. Sequence riskiest-unknowns first. Scaffold and verification harness come before feature logic (**principle-foundational-thinking**).

- **Baseline First:** Capture pre-change baseline metrics or snapshots before editing code, so every verification reads as "old value vs. new value".
- **Single-Model Architecture by Default:** Settle interface contracts and types using the configured `architect` model. Multi-model fan-out is strictly opt-in for high-consequence, irreversible decisions to prevent token burn.
- **Domain-Isolated Partitioning:** Parallelize only across clean seams. Give each subagent its own isolated worktree or branch with strictly bounded file paths (**principle-separate-before-serializing-shared-state**). Never duplicate context across subagents.
- **Write the Plan:** Document the step-by-step phase list. That checklist is what the operator reviews.

---

## Phase C: Run the Scientific Loop

Treat each unit as a discrete experiment:
$$\text{State Hypothesis} \longrightarrow \text{Smallest Change} \longrightarrow \text{Measure Against Predicate} \longrightarrow \text{Keep or Revert}$$

Apply **principle-sequence-verifiable-units**, verifying each unit before starting the next rather than batching checks at the end.

- **Direct Artifact Inspection:** Verify directly against the real artifact, never a delegate's self-report. When a step passes too easily, suspect the observation method before the system.
- **Audit Delegate Diff:** Audit subagent diffs yourself. If a delegate games a check, tighten the contract. If a check itself is faulty, fix the check in its own commit rather than routing around it.
- **Binary Verdicts:** A verdict is `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE`. Inconclusive is treated as a failure. Revert unverified changes immediately.

---

## Phase D: Maintain the Decision Trail

Log decisions as they happen, creating a canonical decision trail with one row per decision and unit (timestamp, choice, rejected alternatives, runtime evidence links). This trail plus the git diff is what allows the operator to step away and trust the completed run upon return.

---

## Phase E: Verify the Whole System & Hand Back

Check the entire integrated system against the Phase A predicate on the real product, not just isolated unit harnesses. Encode any recurring failure or lesson as a lint rule, type constraint, or deterministic test script (**principle-encode-lessons-in-structure**).

---

### Output Format

Reply with high information density (no conversational fluff):
- **Bespoke playbook designed:** Summary of the synthesized phases.
- **Predicate proof:** Real artifact evidence proving the Phase A predicate is satisfied `[measured]`.
- **Decision trail:** Summary of key choices made and alternatives rejected.
- **What shipped vs. open items:** Clean inventory of completed units and any deferred follow-ups.
