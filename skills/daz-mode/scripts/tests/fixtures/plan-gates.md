# Notes tags plan

Adds tags to notes and a tag filter to the list. Three PRs in two phases. P1 and P2 land at the phase 1 gate, P3 at the phase 2 gate.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `skills/daz-mode/playbooks/autopilot-stack.md`. The root lands each phase after the operator's go at its gate.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] On the operator's go, arm a `/goal` with this exact text. "Run docs/plan.md with docs/plan.md.handoff.md, P1 and P2 in phase 1 and P3 in phase 2, until every PR has landed. At each phase gate it stops landing and waits for the operator's go."
- [ ] Arm the 30-minute audit tick with the harness's recurring schedule tool.
- [ ] Use the tick prompt from the playbook. It posts a status message only when something changed.
- [ ] When the root's session ends or compacts, resume with this prompt, verbatim. "Resume the program in docs/plan.md per `skills/daz-mode/playbooks/session-pickup.md`. Read the plan, its handoff and the Standing orders, re-arm the /goal and the tick, and continue from the handoff's next step."

### Standing orders

1. Build and test in the dev container, never on the laptop.
2. Run the full gate once before the PR and once at the final head.

### Spawn owners

- [ ] Spawn one fresh owner per PR. Its brief is the PR's section, its handoff notes, and the Standing orders.

### PR mechanics, for every PR

- [ ] Open the PR ready, never draft.

### Verdict and merge, for every PR

- [ ] After each clean verdict, record the head SHA, patch-id and verdict in the handoff.

### Phase gates

- [ ] Phase 1 gate after P1 and P2. Review folder `media/phase-1/`.
  - [ ] Operator lane. On a real phone, add the tag "home" to a note. Save `media/phase-1/phone.jpg`. Pass when the tag shows under the note's title.
- [ ] Phase 2 gate after P3. Review folder `media/phase-2/`.

### Boot recipe, for every live lane

- [ ] Start the app with `lane.sh start web 3000 -- npm start` and stop it with `lane.sh stop --all`.

## Add tags to notes (P1)

**Depends on.** None.

**Files.**

- [ ] Edit `src/notes.ts`.

**Build.**

- [ ] Add a `tags` array to `Note` in `src/notes.ts`.

**You see.**

- [ ] A note shows its tags under its title.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/notes.test.ts` gains a case for two tags. Run `npm test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Live lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open a note at trunk and head. Save `p1-lane1.png`. Pass when both show the same text and head shows the tag row.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time to open a note.
- [ ] Probe. Open a note ten times at trunk and head, interleaved.
- [ ] Baseline. The trunk median from the same interleaved run as head's.
- [ ] Rule. Head is no more than 10 percent slower than trunk.

**Review gate.** Phase 1 gate.

- [ ] Copy lane 1 screenshots into `media/phase-1/P1-tags.png`.
- [ ] Record a 30 second video of the change. Save it as `media/phase-1/P1.mp4`.
- [ ] Do not stop. The operator reviews the screenshots and the video with the rest of the phase at its gate.

**Merge.**

- [ ] The root appends it to the stack and lands the phase after the operator's go.

## Store tags in the index (P2)

**Depends on.** P1.

**Files.**

- [ ] Edit `src/index.ts`.

**Build.**

- [ ] Write tags into the search index in `src/index.ts`.

**You see.**

- [ ] Searching for a tag finds its notes.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/index.test.ts` gains a tag search case. Run `npm test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Live lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Search for a word at trunk and head. Save `p2-lane1.png`. Pass when both list the same notes.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Search latency.
- [ ] Probe. Twenty searches at the parent head and at head, interleaved.
- [ ] Baseline. The parent head median from the same interleaved run as head's.
- [ ] Rule. Head is no more than 10 percent slower.

**Review gate.** None. P2 is not review-gated.

**Merge.**

- [ ] The root appends it to the stack.

## Filter the list by tag (P3)

**Depends on.** P2.

**Files.**

- [ ] Edit `src/list.ts`.

**Build.**

- [ ] Add a tag filter to `src/list.ts`.

**You see.**

- [ ] Choosing the tag "home" lists only notes tagged home.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `src/list.test.ts` gains a filter case. Run `npm test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Live lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open the list at trunk and head. Save `p3-lane1.png`. Pass when both list the same notes and head shows the filter.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time to filter 2,000 notes.
- [ ] Probe. Filter ten times at the parent head and at head, interleaved.
- [ ] Baseline. The parent head median from the same interleaved run as head's.
- [ ] Rule. Under 50 ms.

**Review gate.** Phase 2 gate.

- [ ] Copy lane 1 screenshots into `media/phase-2/P3-filter.png`.
- [ ] Record a 30 second video of the filter. Save it as `media/phase-2/P3.mp4`.
- [ ] Do not stop. The operator reviews the screenshots and the video with the rest of the phase at its gate.

**Merge.**

- [ ] The root appends it to the stack and lands the phase after the operator's go.

## Close the program

- [ ] Every box above is checked with its evidence. An operator lane counts only as PASS or as a waiver recorded in the handoff.

## Appendix A. Prototype evidence

None needed. The change follows the existing note fields.
