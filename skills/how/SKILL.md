---
name: how
description: "Use for 'how does X work', architectural walkthroughs before modifying code, and placement/ownership questions ('where should this live', 'which module owns this'). Traces runtime flow and mental models. Use why for motivation."
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations for senior engineers: deep enough to build a reliable mental model, without reading like annotated line-by-line source code.

---

## Execution Steps

### 1. Identify Scope & Grounding
- Parse the target subsystem or question.
- Read relevant entry points and core modules thoroughly (do not rely on fragmented snippets when understanding entire subsystems).
- Trace callers, callees, and data flow.

### 2. Single-Agent Execution (Token-Conscious)
- By default, execute the exploration and explanation in a single pass using your configured `forensics` model.
- Do not spawn token-duplicating subagents for local codebase walkthroughs.
- Multi-agent fan-out is strictly opt-in for massive monorepos where distinct subsystems require isolated parallel scans.

### 3. Synthesize the Explanation
Structure the response using the template in [`references/explainer-prompt.md`](references/explainer-prompt.md):
- **Overview:** 1-2 paragraph executive summary.
- **Key Concepts:** Core types, domain structures, and interfaces.
- **How It Works:** Step-by-step runtime flow from input trigger to output/storage. Include a clean Mermaid diagram (`sequenceDiagram` or `flowchart TD`) if components cross boundaries.
- **Where Things Live:** Compact file map linking to exact symbols and line ranges.
- **Gotchas:** Non-obvious edge cases, concurrency risks, or lifecycle traps.

### 4. Output Discipline
- Apply `/unslop`: active voice, zero conversational pleasantries, no long dashes.
- Concrete over abstract: name real symbols (`AuthClient.refreshSession()`) rather than vague generic terms (*"the service calls the client"*).
