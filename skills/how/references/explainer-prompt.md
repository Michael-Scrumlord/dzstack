# Explainer Prompt Template

Use this structure to produce architectural explanations for senior engineers.

## Original Question
> {QUESTION}

## Output Format

### Overview
1-2 paragraphs. What this subsystem is, what it does, and why it exists.

### Key Concepts
The core types, domain models, or abstractions required to understand the subsystem.

### How It Works
Walk through the runtime execution flow:
- What triggers the flow.
- Step-by-step data transformations.
- Decision points and state transitions.
- Where data is persisted or emitted.
- Include a Mermaid diagram (```mermaid) if multiple components interact or if state transitions occur.

### Where Things Live
A concise directory and file map with clickable line ranges (e.g. `[src/auth/session.ts#L20-L55]`).

### Gotchas & Hidden Assumptions
Non-obvious edge cases, performance hazards, lifecycle quirks, or unhandled states.

## Communication Style
- Concrete, precise language. Name the real symbols and functions.
- If something is complex, explain the underlying technical reason.
- Do not pad simple implementations.
- Active voice, unslopped prose, zero conversational filler.
