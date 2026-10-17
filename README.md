# dzstack

Token-efficient, high-rigor agent engineering stack for Cursor, Claude Code, Antigravity, Codex, OpenCode, and portable Agent Skills.

`dzstack` is built on top of the engineering rigor popularized by Lauren Tan's `pstack`, adapted for extreme token conservation, single-model and multi-model flexibility, negative LoC bias, and zero-slop execution.

---

## Core Philosophy: Daz Mode (`/daz-mode` / `/dzstack`)

- **Ruthless Token Conservation:** Single-agent defaults for review and interrogation. Context shielding ensures subagents receive only narrow domain slices and type signatures, never full-repo dumps.
- **Negative LoC Bias:** Measure code quality by simplicity, dead branch elimination, and line deletion. Reject refactors that inflate boilerplate.
- **Design Pattern Transparency:** When architectural design patterns are introduced, code retains a standardized educational tag:
  ```ts
  // Pattern: <Canonical Name> - <1-line rationale>
  ```
- **Single-Model Default / Multi-Harness Portability:** Runs seamlessly in single-provider harnesses (such as Claude Code) without requiring multi-model fan-out, while supporting multi-model bake-offs when configured.
- **Empirical Decisions Over Speculation:** If behavior, layout, performance, or edge cases can be proven by executing a 10-line script or test, run the code rather than asking the user.
- **5 Mandatory UI States:** Every UI component must prove default, loading (fixed geometry), empty (actionable CTA), error (retryable), and stress (text overflow, mobile 375px / desktop 1280px).
- **Prose & Code Hygiene:** Zero conversational filler, no sycophancy, no narrative comments, and evidence-labeled claims (`[measured]`, `[inferred]`, `[observed]`).

---

## Quick Start

### 0. Install (one clone, every harness)
```bash
git clone <this repo> ~/dzstack      # Michael's machines: gitea:sirius/dzstack.git
~/dzstack/scripts/link.sh            # links skills into ~/.claude/skills and ~/.agents/skills (Codex), agents into ~/.claude/agents
```
`git pull` in the clone updates every harness. Run `link.sh` again after adding or renaming a skill. Cursor installs from `.cursor-plugin/`.

### 1. Configure Models
Run `/setup-dzstack` to inspect or generate your model mapping file (`~/.cursor/rules/daz-models.mdc` or `~/.agents/daz-models.md`). Roles inherit hierarchically so you only need to configure primary models:
```
orchestrator / deep reasoning -> architect / forensics -> code / fast
```

### 2. Enter Daz Mode
Activate the core engineering workflow in any session:
```bash
/daz-mode
# or
/dzstack
```

---

## System Architecture

### 1. Core Engine & Router
- `skills/daz-mode/SKILL.md`: Main execution harness, non-negotiables, complexity/static hygiene caps, and task router.
- `skills/dzstack/SKILL.md`: Slash-command alias (`/dzstack`) that activates `daz-mode`.
- `skills/setup-dzstack/SKILL.md`: Role-to-model configuration (`orchestrator`, `architect`, `code`, `fast`, plus child roles) and token budget gates.
- `skills/figure-it-out/SKILL.md`: Bespoke playbook generator for novel or cross-cutting engineering initiatives.
- `skills/daz-mode/references/harnesses.md`: Canonical multi-harness adapter table (skill folders, model files, session transcripts, subagent tools, and structured-question tools across Cursor, Antigravity, Claude Code, Codex, OpenCode, and Pi).
- `skills/daz-mode/references/forges.md`: One place that maps PR, CI and merge steps to GitHub (`gh`), Gitea (`tea`, MCP, or REST) and Origin.
- `agents/daz-agent.md`: The subagent that runs in Daz Mode. `agents/comment-sicko.md`: A comment-purging reviewer.

### 2. Playbooks (`skills/daz-mode/playbooks/`)
- `bug-fix.md`: Scientific defect reproduction, narrowest patch, and empirical proof.
- `feature.md`: Domain modeling first, anti-bloat and complexity caps, and 5 mandatory UI states.
- `ideation.md`: Feature brainstorming, technical feasibility, and phased roadmapping.
- `investigation.md`: Read-only architectural forensics and trade-off matrices.
- `refactoring.md`: Deterministic behavior preservation with negative LoC balance.
- `ui-parity.md`: Visual equivalence verified by image or computed DOM metrics.
- `shipping.md`: Forge-neutral shipping (`references/forges.md`), patch-id validation, and contiguous stack landing.
- `opening-a-pr.md`: Conventional commits, 40-line briefing limit, and structured evidence.
- `autonomous-run.md`: Unattended loop execution driven to a verifiable exit predicate.
- `session-pickup.md`: Cold resume from transcripts without re-deriving completed work.
- `pause-safely.md`: Clean boundary checkpointing, `wip:` commits, and off-context resume notes.
- `autopilot-full.md`: Autonomous one-owner-per-PR execution from build to squash-merge.
- `autopilot-stack.md`: Linear stacked PR construction delivered for human review.
- `babysit.md`: Frontier-first CI and review monitoring without token waste.
- `eval.md`: Double-blinded experimental evaluation against structured rubrics.
- `hillclimb.md`: Iterative metric optimization keeping only measurements that advance the score.
- `multi-phase-plan.md`: Decomposing complex initiatives into sequenced verifiable units.
- `orchestrate.md`: Multi-worker coordination with worktree isolation and minimal context overlap.
- `perf-issue.md`: Profile-guided performance optimization across 8 strategy families.
- `prototype.md`: Throwaway proof-of-concept spikes to eliminate unknowns before production code.
- `runtime-forensics.md`: Dynamic diagnosis of running processes, heap dumps, and live exceptions.
- `trace-forensics.md`: Querying execution traces and call trees transformed into SQLite.
- `worktree-cleanup.md`: Auditing and safe pruning of orphaned git worktrees.
- `authoring-a-skill.md`: Authoring new portable Agent Skills according to specifications.

### 3. Architecture, Forensics & Review
- `skills/architect/SKILL.md`: Interface depth, system trade-offs, and design red-flag elimination.
- `skills/interrogate/SKILL.md`: Contrarian review, complexity and type-safety audit, and lead judgment.
- `skills/arena/SKILL.md`: Isolated candidate bake-offs ($N=3$) with worktree isolation.
- `skills/how/SKILL.md`: Subsystem walkthroughs and execution tracing.
- `skills/why/SKILL.md`: Git archaeology and cross-source historical reasoning.
- `skills/blast-radius/SKILL.md`: Mapping ripple effects and proving the one safety fact with real code execution.

### 4. Verification & Testing
- `skills/tdd/SKILL.md`: Red-green-refactor loop, undefined-return mutation check, and pure-function extraction.
- `skills/create-verification-skill/SKILL.md`: Generating project-local verification drivers and feature maps.
- `skills/maintain-verification-skill/SKILL.md`: Auditing and synchronizing verification maps as codebases evolve.

### 5. Hygiene, Collaboration & Writing
- `skills/unslop/SKILL.md`: 33 rules of clean engineering prose and token frugality.
- `skills/no-comments/SKILL.md`: Comment purification and dead-symbol sweep preserving only educational design pattern tags.
- `skills/automate-me/SKILL.md`: Capturing working conventions into customized `-mode` skills.
- `skills/bro/SKILL.md`: Ultra-condensed plain-English explanation stripped of jargon.
- `skills/recall/SKILL.md`: Reconstructing working context from transcripts and git records.
- `skills/reflect/SKILL.md`: Multi-lens post-task reflection routing learnings into structural skills.
- `skills/show-me-your-work/SKILL.md`: Tabular decision logging (`decisions.tsv`) with verified evidence.
- `skills/swarm/SKILL.md`: Coordinating parallel workers across partitioned slices or races.
- `skills/teach/SKILL.md`: Interactive codebase walkthroughs with progressive diagrams.
- `skills/technical-writing/SKILL.md`: Diátaxis-structured technical documentation and RFCs.
- `skills/typescript-best-practices/SKILL.md`: Strict TypeScript types, branded types, and zero-overhead invariants.

### 6. The 26 Principle Skills (`skills/principle-*/`)
Executable leaf skills grounding architectural and operational decisions:
`principle-attack-the-premise`, `principle-boundary-discipline`, `principle-build-the-lever`, `principle-derive-state-never-duplicate-it`, `principle-encode-lessons-in-structure`, `principle-exhaust-the-design-space`, `principle-experience-first`, `principle-fail-loud-and-fast`, `principle-fix-root-causes`, `principle-foundational-thinking`, `principle-guard-the-context-window`, `principle-laziness-protocol`, `principle-make-operations-idempotent`, `principle-migrate-callers-then-delete-legacy-apis`, `principle-minimize-reader-load`, `principle-model-the-domain`, `principle-never-block-on-the-human`, `principle-outcome-oriented-execution`, `principle-prove-it-works`, `principle-redesign-from-first-principles`, `principle-separate-before-serializing-shared-state`, `principle-sequence-verifiable-units`, `principle-subtract-before-you-add`, `principle-test-behavior-not-implementation`, `principle-type-system-discipline`, `principle-zero-dependency-inflation`.

---

## Maintaining dzstack

- **Structure & hygiene check:** `node scripts/check.mjs` before every commit. It validates frontmatter, skill names, descriptions, cross-references, `principle-*` references, router coverage, Codex policies, banned legacy tokens, and comment-sicko prompt sync.
- **Hidden skills** need both `disable-model-invocation: true` (Claude Code, Cursor) and `agents/openai.yaml` with `allow_implicit_invocation: false` (Codex). Without the second, Codex lists the skill in every session (measured: 79 listed skills before, 37 after).
- **Scripts:** `cd skills/daz-mode/scripts && bun run typecheck && bun test`.
- **Hosting:** the source of truth is Gitea (`sirius/dzstack`); the public GitHub repository (`Michael-Scrumlord/dzstack`) is a mirror kept by `sirius-github` (`github-publish`). Push to Gitea only.

