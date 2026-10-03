### Investigation Playbook

**You own the answer. Plan, inspect, explain.**

Investigation requests are strictly read-only. They produce a cited explanation, architectural map, or trade-off recommendation—never an unprompted code change.

---

### Execution Steps

1. **Establish the Read-Only Invariant.**
   - Do not modify, create, or delete code files during an investigation.
   - Do not stage commits or open PRs.
   - Throughput checkpoint: `n/a: read-only investigation`.

2. **Single-Agent Forensics (Thorough File Reading).**
   - Conduct the investigation in the primary agent to avoid spawning token-duplicating subagents.
   - **Thorough over fragmented reads:** When examining core modules, read complete files rather than isolated snippets. Architectural gotchas, hidden side effects, and cleanup handlers are frequently missed when reading only narrow slices.
   - Trace the entire data lifecycle: entry points, state transitions, validation boundaries, and exit points.
   - For motivation or historical questions, inspect git blame and recent commit logs on relevant lines.

3. **Synthesize the Analysis.**
   Structure the response using this senior-engineer template:
   - **Overview:** One-paragraph executive summary of how the subsystem works or the direct answer to the user's question.
   - **Key Concepts & Data Flow:** How data, events, or control flow move from input to output.
   - **Where Things Live:** Exact file paths and line ranges (e.g., `[src/auth/session.ts#L45-L82]`) grounding every explanation.
   - **Gotchas & Hidden Assumptions:** Non-obvious edge cases, performance bottlenecks, race conditions, or unhandled states.
   - **Trade-offs Matrix (for decision questions):** If evaluating competing approaches, provide an objective table comparing complexity, failure modes, performance, and maintainability.

4. **Candor on "Are We Sure?" Questions.**
   - If the user asks "are we sure about X?" or "will this scale?", give your unvarnished technical assessment.
   - Never offer false reassurance or reflexive agreement. Push back directly if the premise or existing design is flawed (**principle-attack-the-premise**).

5. **Clean Handoff.**
   - Conclude the investigation without touching code.
   - If the user decides to act on the findings, transition cleanly to the appropriate execution playbook:
     - Bug discovered $\to$ `playbooks/bug-fix.md`
     - New capability needed $\to$ `playbooks/feature.md`
     - Structural cleanup needed $\to$ `playbooks/refactoring.md`
