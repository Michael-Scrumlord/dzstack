### Multi-phase or multi-PR plan

**You own the plan, not the code. The plan is a checklist an owner runs box by box and the operator audits from the evidence.** The plan is the deliverable. Do not implement.

1. When the change is one or two files with an obvious approach, skip the plan. Say so and stop.
2. Settle open questions by prototype before you write. Run `playbooks/prototype.md` for each. Keep the branch, the SHA, and the screenshots for Appendix A. Ask the operator only about a product or preference call that no run can settle. Give options (the **principle-never-block-on-the-human** skill).
3. Explore in subagents using your harness's subagent tool (`../references/harnesses.md`) and an explicit model per the Subagents section (the **principle-guard-the-context-window** skill). Each returns file pointers, conventions, test commands, and entry points. No inlined dumps.
4. Copy the skeleton below into the plan file and fill every placeholder. Unless the operator names a path, write the file under the agent store's `docs/`. Keep every heading and every sub-block in the order shown. One section per PR. One PR is one change with its own evidence (the **principle-sequence-verifiable-units** skill). Name the execution playbook in **How to read this**. Pick between `playbooks/autopilot-full.md` and `playbooks/autopilot-stack.md` per the rule at the end of `playbooks/autopilot-stack.md`. A standing program takes `playbooks/orchestrate.md`. Group the PRs into phases and fill **Phase gates**. Every PR belongs to exactly one phase. A plan with any review-gated PR runs `playbooks/autopilot-stack.md`. Two or three gates suit most programs. The operator's attention is the scarcest input, so the program stops for it only there. Fill **Standing orders** with every constraint the operator would otherwise repeat in each brief.
5. Write under `/technical-writing` in full, then `/unslop`. The body is one Diátaxis mode, how-to. Appendices hold explanation and reference. Each heading states the task or the finding. No long dashes. No mid-sentence colons.
6. Run `node skills/daz-mode/scripts/check-plan.mjs <plan.md>` and fix every line it prints (the **principle-encode-lessons-in-structure** skill). A plan already in execution keeps the gates it was written with and is not re-checked.
7. Hand back. Post the plan path and the script's output, then stop. Execution starts on the operator's explicit go, under the execution playbook the plan names.

**Verification.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked (the **principle-prove-it-works** skill). That sentence is the verification rule. Every verification block opens with it. The live block is mandatory. Live lanes at the PR head drive the real surface through its control skill (single-agent sequentially by default, or in parallel via the **swarm** skill when requested). Each lane is one box with a concrete scenario, the screenshot or artifact it saves, and its pass predicate. Lane 1 is the **Regression lane against trunk.** It runs the same load-bearing scenario on trunk and head. If trunk does not have the feature, the lane records that fact and gates the behavior the diff adds plus the end state the user waits for instead of inventing a trunk result. Add one lane per distinct user-facing scenario the PR touches. The perf gate is dual-sided. Trunk and head must both produce the named metric. If trunk lacks the feature, also isolate the work the diff adds and set an absolute budget for that work plus the end-to-end state the user waits for. Do not claim a ratio between unlike scenarios. The perf block names the metric, the interleaved probe, the trunk baseline taken in that same interleaved run, and the rule with the number that fails. A trunk number from an earlier run or a quieter moment is not a baseline.

**Phase gates.** The operator reviews at phase gates, not per PR. A PR that changes an interaction writes `**Review gate.** Phase <phase> gate.`, saves its screenshots and video in the phase's review folder, and does not stop. A PR whose mistake would be costly to undo after more PRs land on it (a data migration that rewrites rows, a public contract, a security boundary) is its own one-PR phase. A PR that changes no interaction writes `**Review gate.** None. <PR id> is not review-gated.` and no boxes under it. A check only a person can run (a real device, listening by ear, a physical TV) is an operator lane. It is listed under its phase gate, never in a PR's live block, and runs at the phase tip. A PR's verdict covers its own lanes. The gate's go needs every operator lane to PASS, or a waiver the operator names. A product question that comes up between gates goes in the handoff with options and a default. The program proceeds on the default unless the choice is costly to undo, and the question goes in the next gate message.

**Handoff.** The root keeps `<plan file name>.handoff.md` beside the plan and never commits it. It records per PR the head SHA, patch-id and verdict, then the merge SHA once landed, each operator decision and waiver, parked questions, and the next step. Only the root writes it. An owner's brief is its PR section, its handoff notes and the Standing orders.

**Control skill.** Pick it by surface. Use project-local verification skills generated by `create-verification-skill` (`verify-<app>`), Playwright/CDP for web and Electron (`control-ui`), or PTY/tmux for CLIs (`control-cli`). Native mobile uses whatever simulator-driving skill the repo has. A PR that touches two surfaces gets lanes on both. A surface with no control skill is a risk in Appendix C, and its live block still names how each lane drives it.

````markdown
# <Program> plan

<Under ten lines. What changes, for whom, the rule the program enforces, and the PR ids in order.>

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `skills/daz-mode/playbooks/<execution playbook>.md`. <Who merges. The phases and their gates, the only points where the program stops for the operator.>

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the operator's go, arm a `/goal` with this exact text. "<The plan path, the handoff path, the PR ids by phase, the verification rule, and the done condition.> At each phase gate it stops landing and waits for the operator's go."
- [ ] Read these from the installed skill directory at program start. Re-read them at every tick.
  - [ ] `skills/daz-mode/playbooks/<execution playbook>.md`
  - [ ] `skills/interrogate/SKILL.md`
  - [ ] `<control skill path>`
  - [ ] `skills/daz-mode/playbooks/opening-a-pr.md`
  - [ ] `skills/<each other leaf skill the program uses>`
- [ ] Arm the 30-minute audit tick via `/loop` or your harness's recurring schedule tool (`../references/harnesses.md`). Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook, the armed /goal, the handoff and the Standing orders. Audit the operation against them and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. When anything changed since the last tick, post a status message to the operator in chat with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what landed, the waiting gate, and blockers. Post nothing while a gate waits and nothing changed."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.
- [ ] When the root's session ends or compacts, resume with this prompt, verbatim. "Resume the program in <plan path> per `skills/daz-mode/playbooks/session-pickup.md`. Read the plan, its handoff and the Standing orders, re-arm the /goal and the tick, and continue from the handoff's next step."

### Standing orders

Paste these verbatim into every owner brief and every resume. When the operator restates an instruction, append it here before acting on it. Under `playbooks/orchestrate.md` this list seeds `preferences.md`.

1. <Where code is built and tested, and where it may not be.>
2. <Host etiquette. On a shared or hot host, heavy commands run at low priority, one full gate at a time, never beside live lanes.>
3. <Gate cadence. The quick gate and the touched tests while working. The full gate once before the PR and once at the final head.>
4. <Cleanup. Stop every lane server with `skills/daz-mode/scripts/lane.sh stop --all`, remove verify clones and bundles, and say so in the report.>
5. <Forbidden. Paths, services, paid tools, deploys.>

### Spawn owners

- [ ] Spawn one fresh owner per PR with the full lifecycle the execution playbook names. Its brief is the PR's section, its handoff notes, and the Standing orders.
- [ ] Spawn every verifier and audit pass from the root. Some harnesses give a subagent no spawn tool (`../references/harnesses.md`).
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] <PR id> and <PR id> are independent and first. Both branch from `main`.
  - [ ] <PR id> after <PR id>.
- [ ] Hold the file boundaries. <PR id or class> touches only `<glob>`.
### PR mechanics, for every PR

- [ ] Resolve the forge once per `../references/forges.md` and use it for every PR operation.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Rerun a timing test that failed once, alone on a quiet host. A second failure is real. Raise a limit only with the root's countersign.
- [ ] Run `/unslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run independent verification (or fan out via `skills/swarm/SKILL.md` when parallel lanes are configured). Check the gates lane, the live lanes from the PR's **Verify, live** block, the perf lane from its **Verify, perf** block, and an audit pass (`/interrogate`) that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh verification pass and a fresh verdict.
- [ ] Give the audit pass the diff, the receipts, the PR's boxes, at most six named risks, and a token cap.
- [ ] <The merge or append rule from the execution playbook, with the patch-id rule from `playbooks/shipping.md`.>
- [ ] After each clean verdict, record the head SHA, patch-id and verdict in the handoff, then spawn the next owner the dependency graph allows without waiting for the operator.

### Phase gates

- [ ] Phase 1 gate after <PR ids>. Review folder `<media path>/phase-1/`.
  - [ ] Operator lane. <Device, how the tip build reaches it, the scenario>. Save `<photo or note path>`. Pass when <predicate>.
- [ ] Phase 2 gate after <PR ids>. <Same fields.>
- [ ] At each gate, post one message with the phase tip SHA, the PR links bottom-up with one line, verdict and patch-id each, the review folder, the operator lanes to run at the tip, each PR's behavior changes from its Blast Radius, parked questions with their defaults, and the resume prompt. Then stop landing until the operator's go.
- [ ] While a gate waits, build at most the next phase on its tip, never above a one-PR phase, and not when the Standing orders say to wait.
- [ ] A gate finding or failed operator lane goes back to the PR that owns the code. The root rebases and re-verifies everything above per `skills/daz-mode/playbooks/autopilot-stack.md` step 7.
- [ ] On the go, with every operator lane PASS or waived in the handoff, land the phase bottom-up per `skills/daz-mode/playbooks/shipping.md` and record the merge SHAs in the handoff. Deploy only when the go says so.

### Boot recipe, for every live lane

Each live lane runs in an isolated worktree or environment at the PR head. Drive through the project verification skill or control harness (`control-ui` / `control-cli`).

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] <Start the backend and the surface with `skills/daz-mode/scripts/lane.sh start <name> <port> --dir <path> [--wait <s>] -- <command>`. It records the server's own process group, never a wrapper shell's pid, and waits for the port.>
- [ ] <Deliver input only through the control skill's commands. Name the read-only diagnostics.>
- [ ] Save every screenshot or capture artifact to `/tmp/verify-<pr-id>/lane-<n>/<slug>.png` and return the paths with the report.
- [ ] When the lanes finish, run `lane.sh stop --all`, which fails if a port still answers, and remove the verify clone.

## <Task as a verb phrase> (<PR id>)

**Depends on.** <PR id, or None.>

**Files.**

- [ ] Edit `<path>`.
- [ ] Create `<path>`.
- [ ] Delete `<path>`.

**Build.**

- [ ] <One change. Name the symbol and the file.>

**You see.**

- [ ] <One observable result, with the exact log line or screen state.>

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] <Test file and the case it gains.> Run `<command>`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Live lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run <the same load-bearing scenario> at trunk and head. If trunk lacks the feature, record that and gate <the behavior the diff adds plus the end state the user waits for>. Save `<slug>.png`. Pass when <predicate>.
- [ ] Lane 2. <Scenario.> Save `<slug>.png`. Pass when <predicate>.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. <What is measured at both trunk and head. If trunk lacks the feature, also name the diff-added work and the end-to-end state the user waits for.>
- [ ] Probe. <The command or procedure, run at trunk and at the head, interleaved. Both sides must produce the metric.>
- [ ] Baseline. <value> from the same interleaved run as head's, at trunk, or at the parent PR's head when the PR is stacked.
- [ ] Rule. <Head against trunk, with the number that fails. If the scenarios differ, add absolute budgets for the diff-added work and the user-visible end state instead of an invalid ratio.>

**Review gate.** Phase <phase> gate.

- [ ] Copy lane <n> screenshots into `<media path>/phase-<phase>/<pr-id>-<slug>.png`.
- [ ] Record a 30 to 60 second video of the change on a lane VM. Save it as `<media path>/phase-<phase>/<pr-id>.mp4`.
- [ ] Do not stop. The operator reviews the screenshots and the video with the rest of the phase at its gate.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The root appends it to the stack. After the operator's go at its phase gate, the root lands the phase per `skills/daz-mode/playbooks/shipping.md`.

## Close the program

- [ ] Every box above is checked with its evidence. An operator lane counts only as PASS or as a waiver recorded in the handoff.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

<Each open question a prototype answered, with the branch, the SHA, and the artifact links. Each question that stays unproven.>

## Appendix B. Alternatives rejected

<Each approach weighed and why it lost.>

## Appendix C. Risks

<Each risk with the PR it lands in and what the owner watches.>

## Appendix D. Links and reading list

<Docs to read before editing. Which PRs get `skills/how/SKILL.md` and `skills/interrogate/SKILL.md`. The trail per `skills/show-me-your-work/SKILL.md`.>
````

**Reply:** the plan path, the PR ids with their dependencies, the phases and their gates, what the prototypes proved and what stays unproven, and the check script's output.
