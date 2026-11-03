---
name: codebase-survey
description: "Survey a whole codebase to understand it and find code smells and likely defects, building artifacts as you go: inventory, module map, dependency graph, diagrams, static-analysis results, hotspots and ranked findings with evidence. Use for 'audit this codebase', 'find code smells', 'tech-debt review', 'what's wrong with this repo', onboarding onto an unfamiliar repo, or before a large refactor."
---

# Codebase Survey

Understand a whole codebase, then find its smells and likely defects with evidence. The artifacts you write are the memory: write each one as you finish its phase, so the survey survives context limits and any later session, of any model, can pick it up from `STATE.md`.

## Ground rules

- **Survey a copy, change nothing.** Clone the repo to a scratch folder at a recorded commit and survey that. Installing dependencies in the copy is fine, so lint and typecheck can run. Editing source is not: fixes come later, from the findings.
- **Artifacts live outside the source tree**, in `<repo>-survey/` beside the copy, unless the person names a place.
- **Tools count, you explain.** Graphs, counts and lint results come from tools (`references/tools.md`). Your reading explains them and confirms or rejects their hits.
- **Raw output goes to `raw/`.** Read its summary (counts, the top rows), never the whole of it.
- **On a shared or busy machine**, run heavy tools at low priority (`nice -n 10`), one at a time.

## Pick a depth

Write the depth in `STATE.md` before phase 1.

| Depth | When | Phases |
|---|---|---|
| Quick | a first look, a small model, under an hour | 1 to 5, then 8 with the top 5 findings |
| Standard | the default | 1 to 8 |
| Deep | a large or critical codebase | 1 to 8; phase 6 split by module across subagents. The root spawns them (some apps don't let a subagent spawn its own); each gets one module's files and these rules, and writes `modules/<module>.md` |

## Phases

Each phase ends by writing its artifact and ticking it in `STATE.md`.

1. **Inventory**, `01-inventory.md`. Run `scripts/inventory.sh <copy> > <survey>/01-inventory.md` from this skill's folder: languages and lines, the largest files, churn, hotspots, files that change together, authors per hotspot. Then add by hand the entry points (main, CLI commands, server routes, jobs, handlers), the build, test and lint commands from the manifest and CI config, and what the README says the code does.
2. **Map**, `02-map.md`. One line per top-level module: what it does, its entry point, its size. A Mermaid `graph` of the modules, at most 25 nodes, grouped by folder if there are more. Name the layering you expect (for example UI, then services, then storage). Phase 3 checks the code against it.
3. **Dependencies**, `03-deps.md`. Build the import graph with the language's tool. Record cycles, imports that break the phase 2 layering, the 10 most imported modules (risky to change), the 10 that import the most (they know too much), and modules nothing imports that aren't entry points. For third-party packages, record unpinned versions, duplicates, abandoned ones and known vulnerabilities from the audit tool.
4. **Static analysis**, `04-static.md`. Run the project's own lint, typecheck and tests first, the way its CI does, and record what fails. Then the extra analyzers: dead code, duplication, complexity, security patterns, secrets. Record counts per rule, the worst files, and every tool that wouldn't run, with the reason.
5. **Hotspots and flows**, `05-flows.md`. Rank the 10 files that are both complex (phase 4) and often changed (phase 1); defects cluster there. Draw 3 to 5 of the main paths through the system (a request, a job, a command) as Mermaid `sequenceDiagram`s from entry to storage and back. Draw the data model as a Mermaid `erDiagram` from the schema or migrations, if there is one.
6. **Deep read**, `modules/<module>.md`. Read the hotspots and the flow files whole, not in snippets: side effects, cleanup and error paths hide at the edges. Then give every layer at least one file of its own, the client's stateful screens and async code included, even when no hotspot points there. Different layers hide different defects, and a survey that reads only the server misses the client's. List what you didn't read in `README.md`. For each module write its purpose, the invariants it relies on, how errors travel, what its tests cover, and its smells with `file:line`. Use `references/smells.md` as the checklist.
7. **Verify.** Take each likely defect as far up this ladder as is cheap: pointed (`file:line`), traced (walked step by step to the bad state), executed (a test, script or crafted input that shows it). Run them in the copy. One executed proof beats a long argument. For parsers and validators, feed them the domain's real vocabulary (the inputs people actually type) as well as random input: a fuzzer finds crashes, while real vocabulary finds valid input that is wrongly rejected. Mark what stays below executed as unproven.
8. **Report**, `findings.md` and `README.md`.

## findings.md

One entry per finding, defects first, then risks, then smells. Style issues get a count, not entries.

```
### F-03 Defect, executed: an import with a bad URL leaves the queue item claimed forever
Where: src/importer/queue.ts:88 (claim) and :131 (no release on throw)
Why it matters: the item never retries; the person sees "importing" with no end.
Found by: the flow diagram for imports, then the deep read; reproduced by tests/repro/f03.test.ts in the copy.
Next: release the claim in a finally block; add the repro as a regression test.
```

Kinds: defect (wrong behavior), risk (a plausible failure under load, bad input or change), smell (makes defects likely or change costly). Confidence: executed, traced, static only, suspicion.

## README.md

- What the codebase is, in five lines.
- The 10 most important findings, one line each, by ID.
- An index of the diagrams.
- What wasn't covered and why: tools that failed, modules not read, the depth chosen.
- How to resume: read `STATE.md`.

## STATE.md

The commit SHA, the copy's path, the depth, a checkbox per phase, the next step, and open questions. Update it after every phase. A later session reads it first and continues from the next step.

## Scale it

- **A small model or low effort**: Quick depth. Follow the phases in order and lean on the script and the tools. Keep each artifact short. Stop after five verified findings.
- **A large codebase** (more than about 200,000 lines): inventory, map and dependencies still cover everything; read only the hotspots and the flow files.
- **No analyzer for the language**: use the grep checks in `references/tools.md` and say so in `04-static.md`.

Related: `how` explains one subsystem, `blast-radius` one change, `why` the history. Phase 7 is the **principle-prove-it-works** skill applied to findings.
