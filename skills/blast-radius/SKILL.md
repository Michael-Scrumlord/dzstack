---
name: blast-radius
description: "Map what a code change could break across the system before it ships, looking beyond immediate callers. Identifies the one fact safety depends on and proves it with real code execution. Use for 'blast radius of X', 'what could this break', or reviewing risky diffs."
disable-model-invocation: true
---

# Blast Radius

Map what a change could break elsewhere in the system before it ships. Listing immediate callers is trivial; the real job is identifying the subtle breakages that a symbol search will not reveal.

---

## The Core Rule: Prove the Safety Fact with Code

A persuasive write-up that sounds plausible is worthless. Never declare a change safe based on textual narration. Identify the **one fundamental fact** that safety depends on, and prove it by running real code.

### The Safety Proof Ladder
For every critical dependency or risky call, push verification as high up this ladder as possible:
1. **Level 1 (Asserted):** You claimed it was safe. *Worthless on its own.*
2. **Level 2 (Pointed):** You cited the exact `file:line` or library source.
3. **Level 3 (Traced):** You walked the logic step-by-step and showed the bad path is unreachable.
4. **Level 4 (Executed):** You wrote a small test or script that executed the real code and asserted the bad state did not happen.
5. **Level 5 (Observed):** You verified the behavior in the live running application.

*Every critical safety claim that stops below Level 4 must be explicitly marked as `[unproven]`.*

---

## Execution Steps

### 1. Analyze the Diff & Downstream Ripple Effects
Inspect the changeset and look beyond direct callers:
- Wire formats & serialized JSON across network boundaries.
- Database columns and migration dependencies.
- Event listeners, message queues, and async microtask timing.
- Pinned third-party library versions and underlying protocol behavior.

### 2. Identify the One Safety Fact
Most changes that appear risky are safe because of a single foundational property (e.g., *"This helper is only called after the session token has already been validated at the gateway"*). Identify that single invariant.

### 3. Prove the Fact with Execution
Write a small, deterministic test or reproduction script that calls the exact function or module with edge-case inputs (**principle-prove-it-works**). If the script passes, safety is proven. If you cannot run it cheaply, mark it `[unproven]`.

### 4. Categorize Risks
- **Confirmed Risks:** Real failure trajectories with a measurable probability and impact.
- **Cleared Risks:** Potential hazards that were investigated and proven harmless by code execution.

---

### Output Format

Reply with high information density (no conversational fluff):
- **Change summary:** What changed and what it now does differently.
- **The one safety fact:** The foundational property safety depends on, its ladder level (e.g. Level 4: Executed), and the execution proof.
- **Confirmed risks:** Specific failure modes, affected files/callers, and impact.
- **Cleared risks:** Investigated hazards proven harmless.
- **Pre-merge proof:** The deterministic script or test verifying the change is safe.
