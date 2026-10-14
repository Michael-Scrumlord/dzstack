---
name: setup-dzstack
description: Configure reasoning budgets and role-to-model assignments for Daz Mode. Writes cross-harness model settings with hierarchical inheritance, modern thinking parameters, and invocation roster support. Use for /setup-dzstack, /dz-budget, "configure dzstack models", or changing model choices.
---

# Setup dzstack

Configure model roles and reasoning budgets for Daz Mode.

Settings are stored in a unified format compatible with all major agent harnesses:
- **Project-Local Override (Optional):** `.dzstack/models.md` (takes precedence when present in a repository).
- **Global Cross-Harness Configuration:** `~/.agents/daz-models.md` (read by Antigravity, Claude Code, Codex, and OpenCode).
- **Cursor Rule Auto-Mirror:** `~/.cursor/rules/daz-models.mdc` (synchronized automatically when Cursor is detected).

---

## The Role Roster & Inheritance Hierarchy

You do not need to configure every micro-task. dzstack uses **hierarchical role inheritance**: child tasks inherit from their parent role unless explicitly overridden.

```
code (Parent Role)
 ├── feature
 ├── bug-fix
 ├── refactoring
 └── perf-issue

architect (Parent Role)
 ├── judgment
 ├── hardest tasks
 └── architect runners

forensics (Parent Role)
 ├── how explorer / explainer
 └── why investigators / synthesizer

reviewer (Parent Role)
 ├── interrogate reviewers
 └── arena cross-judge

ui-designer (Specialist: UI/UX, responsive layouts, design tokens)
 └── Fallback: code

technical-writer (Specialist: READMEs, docs, PR descriptions, unslop)
 └── Fallback: architect

fast-scout (Specialist: bulk directory sweeps, grep triage, low-token scans)
 └── Fallback: code

product-strategist (Specialist: ideation, feasibility, marketability, roadmaps)
 └── Fallback: architect
```

---

## Execution Steps

### 1. Detect Available Models
Identify the model slugs available in your current harness session:
- **Antigravity / Cursor:** Inspect detected environment models or active session models.
- **Claude Code:** the `Agent` tool's `model` takes a fixed alias set: `opus`, `sonnet`, `haiku`, `fable` (or omit it to inherit the parent). Use those, never model generations or dated ids.
- **Codex / OpenCode:** query the CLI's model list (e.g. `opencode models`); Codex usually runs roles on the chat model (`inherit-parent`).
- *Aliases:* `inherit-parent` and `auto` are always valid (they execute the role using the parent chat model).

### 2. Start From What Exists (don't ask again)
Look for an existing configuration first, in this order: `.dzstack/models.md`, `~/.agents/daz-models.md`, then older stacks' files (`~/.claude/pstack-models.md`, `~/.claude/cstack-models.md`). If one exists, derive the dzstack file from it (map its roles onto the roster below, carry over every model restriction), show the result, and write it without prompting: Never Block on the Human. Ask only when nothing exists or a role can't be mapped.

### 2b. Select Reasoning Budget & Thinking Parameters
Current frontier models support native reasoning effort controls (`off`, `low`, `medium`, `high`) alongside explicit token budget caps.

When nothing exists to derive from, ask once for an operational reasoning budget:
- `max : high reasoning (64k tokens)`: Maximum reasoning depth for complex architectural proofs and invariants.
- `high : standard reasoning (16k tokens)`: Default deep reasoning for tricky domain modeling and concurrency.
- `medium : balanced reasoning (4k tokens)`: Balanced performance for day-to-day implementation and refactoring.
- `low : fast reasoning (1k tokens)`: Minimal reasoning latency for quick fixes and routine edits.
- `off : direct execution (0 tokens)`: Thinking disabled for instant execution and deterministic tasks.

#### Thinking Parameter Mappings
| Budget Tier | Native Parameter | Token Budget Equivalent | Best Used For |
|---|---|---|---|
| **`max`** | `effort: "high"` | 64,000 tokens | Multi-phase planning, core architecture, formal verification |
| **`high`** | `effort: "high"` | 16,000 tokens | Tricky debugging, type-system design, cross-stack review |
| **`medium`** | `effort: "medium"` | 4,000 tokens | Standard features, component authoring, refactoring |
| **`low`** | `effort: "low"` | 1,024 tokens | Quick lint fixes, mechanical edits, unit test boilerplate |
| **`off`** | `effort: "off"` | 0 tokens | Fast file sweeps, grep summaries, formatting |

In **Claude Code** the `Agent` tool's `effort` takes `low`, `medium`, `high`, `xhigh` or `max`, and only when the user or the model file asks for it explicitly: map `low` → `low`, `medium` → `medium`, `high` → `high`, `max` → `max`, and leave `off` unset (the agent runs at its default).

### 3. Map Roles & Confirm
Display the configuration table (derived in step 2, or the defaults below). Prompt only if it was not derived from an existing file:

| Role | Purpose | Default Family Recommendation |
|---|---|---|
| **`code`** | Core implementation, bug fixes, refactoring | Fast, high-throughput model (e.g. Claude Code `sonnet`; Codex: the chat model) |
| **`architect`** | Domain modeling, complex concurrency, type contracts | Deep reasoning model (e.g. Claude Code `opus`; Codex: the chat model at high effort) |
| **`forensics`** | Code path tracing, regression archaeology | Fast retrieval model (e.g. Claude Code `sonnet`) |
| **`reviewer`** | Adversarial review, breaking diffs before merge | Independent model family for unbiased second opinions |
| **`ui-designer`** | Visual layouts, CSS, responsive states, design tokens | Multimodal vision model (e.g. Claude Code `opus`) |
| **`technical-writer`** | Clean documentation, commit messages, PR briefs | High-precision prose model (e.g. Claude Code `opus`) |
| **`fast-scout`** | Large directory scans, wide grep triage | Ultra-cheap, fast model (e.g. Claude Code `haiku`) |
| **`product-strategist`** | Feature ideation, marketability, feasibility plans | Strategic reasoning model (e.g. Claude Code `opus`) |

---

## Prompt Prefix Stability & Context Caching Rules

Current models cache prompt prefixes. Dynamic changes at the head of a prompt invalidate cached token prefixes across all turns and subagent calls, significantly increasing latency and API costs.

Follow these rules when constructing harness prompts and subagent instructions:

1. **Anchor Invariant Prefixes at the Head:** Keep system prompts, persona directives, harness rules, and project standards at the very beginning of the prompt. Never insert timestamps, random session IDs, or volatile memory into the header.
2. **Push Dynamic State to the Tail:** Place working directory file listings, transient git diffs, current test output, and user query context strictly at the prompt tail.
3. **Align Subagent Headers:** All subagents spawned in a wave must share the identical system prefix template as the parent harness. This guarantees that subagent invocations hit warm prefix cache windows instantly.
4. **Stable Formatting:** Preserve exact whitespace, line breaks, and heading order in persistent prompts. Minor token discrepancies break prefix match algorithms.

---

### 4. Validate & Write Configuration
Ensure all chosen slugs exist in the detected set (or use `inherit-parent` / `auto`), and that none is on the deny list.

Write the configuration file:
- If in a project repository with a `.dzstack/` directory, update `.dzstack/models.md`.
- Otherwise, write to `~/.agents/daz-models.md`.
- If `~/.cursor/rules/` exists, mirror the content to `~/.cursor/rules/daz-models.mdc` with frontmatter `alwaysApply: true`.

#### Configuration File Format
```markdown
---
description: dzstack per-role model configuration
alwaysApply: true
---
# dzstack model configuration.
# Child roles inherit from parent roles (code, architect, forensics, reviewer) if omitted.
# `inherit-parent` or `auto` runs that role on the parent chat model.
# One file serves every harness, and slugs differ per harness: write `role: claude=sonnet, codex=inherit-parent`.
# A harness with no entry of its own uses inherit-parent.
# budget: high (effort: high, tokens: 16000)
# deny: fable, claude-fable-*      # models never to assign, whatever a role says (cost, policy); globs allowed
code: inherit-parent
architect: inherit-parent
forensics: inherit-parent
reviewer: inherit-parent
ui-designer: inherit-parent
technical-writer: inherit-parent
fast-scout: inherit-parent
product-strategist: inherit-parent
```

### 5. Display the Invocation Roster
Show the exact banner that will appear whenever `/daz-mode` is launched:
```text
[daz-mode active | Budget: <budget> | Code: <code-model> | Arch: <arch-model> | Review: <reviewer-model>]
```
Inform the user that the configuration is active and can be reconfigured anytime via `/setup-dzstack` or `/dz-budget`.
