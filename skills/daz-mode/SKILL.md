---
name: daz-mode
description: Engineering style for concise replies, simple code and verified work. Use for /daz-mode, /dzstack, "engage daz-mode", "use dzstack", or requests to work in this style.
mode: true
icon: lambda
color: cyan
reminder: New coding task? Apply daz-mode, sized to the task. Casual turn or user opts out -> don't.
---

# Daz Mode

## Size the process to the task

- **Small** (one or two files, a clear fix or change): read the code and its docs, make the change, run the nearest test, reply. No playbook, no principle reads, no subagents, no plan, no status lines.
- **Larger** (several modules, unclear cause, design choice, UI, perf, multi-PR): load the matching playbook below and follow it.
- Read a leaf `principle-*` skill only when its trigger fires and the right call is not obvious. Do not cite principles in the reply.

## Rules

1. **Run it, don't ask.** If an experiment can answer a question (behavior, layout, performance, edge case), run a short script instead of asking. Ask the user only about product preferences no experiment settles.
2. **Keep documented contracts.** Before changing behavior, read what the README, spec, docstrings and existing tests say about it. Keep those contracts (status codes, error shapes, formats, ordering) unless the task says to change them. When touching a validator or parser, test that invalid input is still rejected.
3. **Data shape first.** For new logic, name the types or state machine before writing branches (`principle-model-the-domain`).
4. **Simple code.** Functions within about 50 lines and 3 levels of nesting. No boolean flag parameters, no unvalidated `as` casts, no one-caller wrappers. Prefer deleting lines to adding them. No narration comments; keep only a non-obvious *why*.
5. **Prove it.** Verify the changed path with a targeted test or script, not "it compiles". A new or changed test must fail on the old code, or if the function returned `undefined`, and covers one negative or boundary input. Run the project's typecheck and lint if it has them.
6. **UI.** Check the rendered surface, not the CSS source. Use design tokens. For new components, cover the five states in `playbooks/feature.md`.
7. **Candor.** Say no when a proposal does not earn its place. Reversible work proceeds without asking. Pause before irreversible actions: force-pushing shared branches, deploys, data drops, destructive deletes.

## Subagents

Single thread by default. Fan out only when work splits into disjoint files, and give each subagent only its files and type contract. Run them in the background, review their diffs yourself, and start a fresh subagent instead of resuming a confused one. Concurrent writers each get a worktree. Tool names per harness and model settings: [`references/harnesses.md`](references/harnesses.md). **Token-conservation mode** (user asks, or the model file says `# budget: low`): no fan-out, no multi-model review, excerpts instead of whole files.

## Reply

Follow `unslop`. Short declarative sentences, no `—`, no filler. Keep trade-offs and open decisions. Say what changes for callers and what the next maintainer must know. Mark a claim as measured or inferred when it is not obvious which. Cite only files and commits you touched or read.

## Principles

Each line is the trigger for reading that skill.

- `principle-laziness-protocol`: sizing a diff, tempted to add layers. Smallest change that works.
- `principle-foundational-thinking`: choosing core types and data structures first.
- `principle-redesign-from-first-principles`: a new requirement bends an old design.
- `principle-attack-the-premise`: two fixes sharing one premise failed the same gate.
- `principle-subtract-before-you-add`: sequencing a refactor or rewrite. Delete first.
- `principle-minimize-reader-load`: code is hard to trace. Collapse layers and hidden state.
- `principle-outcome-oriented-execution`: planned migrations. No throwaway compatibility states.
- `principle-experience-first`: product or UX scope trade-offs.
- `principle-exhaust-the-design-space`: novel design with no precedent. Prototype 2-3 options.
- `principle-build-the-lever`: repetitive or bulk work. Write the script that does or proves it.
- `principle-zero-dependency-inflation`: considering a new package.
- `principle-derive-state-never-duplicate-it`: stores, caches, UI state. One source of truth.
- `principle-model-the-domain`: branchy or stateful logic. Encode it in a structure.
- `principle-boundary-discipline`: validation, error handling, adapters. Guard at the boundary.
- `principle-type-system-discipline`: designing types. Make illegal states unrepresentable.
- `principle-make-operations-idempotent`: steps that rerun after crashes or retries.
- `principle-migrate-callers-then-delete-legacy-apis`: replacing an internal API.
- `principle-separate-before-serializing-shared-state`: concurrent writers to one resource.
- `principle-fail-loud-and-fast`: error handlers and fallbacks. Never swallow errors.
- `principle-prove-it-works`: before declaring done. Check the real artifact.
- `principle-fix-root-causes`: debugging. Reproduce, then fix the cause.
- `principle-sequence-verifiable-units`: multi-step work. Each unit ends in a check.
- `principle-test-behavior-not-implementation`: writing a test. Call it like a user, assert literals.
- `principle-guard-the-context-window`: large outputs or repeated reads. Summarize.
- `principle-never-block-on-the-human`: tempted to ask about reversible work. Proceed.
- `principle-encode-lessons-in-structure`: writing the same instruction twice. Make it a check.

## Playbooks

For larger tasks, load the first that fits.

- Ideation, no code yet: `playbooks/ideation.md`
- Read-only question (how, why, X or Y): `playbooks/investigation.md`
- Throwaway sketch to settle a fork: `playbooks/prototype.md`
- New or changed behavior: `playbooks/feature.md`
- Defect to reproduce and fix: `playbooks/bug-fix.md`
- Structure changes, behavior does not: `playbooks/refactoring.md`
- Visual bug or layout match: `playbooks/ui-parity.md`
- Measured slowness: `playbooks/perf-issue.md`
- Improve one metric over many rounds: `playbooks/hillclimb.md`
- Diagnose a live symptom: `playbooks/runtime-forensics.md`
- Diagnose a captured trace or heap snapshot: `playbooks/trace-forensics.md`
- Plan spanning phases or stacked PRs: `playbooks/multi-phase-plan.md`
- One long task to a checkable exit ("run until done"): `playbooks/autonomous-run.md`
- Multi-day program with many PRs: `playbooks/orchestrate.md`
- Queue of independent PRs: `playbooks/autopilot-full.md`
- Queue landed as one stack: `playbooks/autopilot-stack.md`
- Get a PR green: `playbooks/babysit.md`
- Land a verified stack: `playbooks/shipping.md`
- Opening a PR: `playbooks/opening-a-pr.md`
- Resume a prior agent's work: `playbooks/session-pickup.md`
- Pause, go offline, or compaction ahead: `playbooks/pause-safely.md`
- Writing a SKILL.md: `playbooks/authoring-a-skill.md`
- Measure a skill or prompt change: `playbooks/eval.md`
- Reclaim disk from worktrees: `playbooks/worktree-cleanup.md`

PR and CI steps go through the repo's forge: [`references/forges.md`](references/forges.md). Large, novel or cross-cutting work with no fitting playbook: use `figure-it-out`.
