---
name: setup-dzstack
description: Configure reasoning budgets and role-to-model assignments for Daz Mode. Writes cross-harness model settings with hierarchical inheritance and invocation roster support. Use for /setup-dzstack, /dz-budget, "configure dzstack models", or changing model choices.
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
- **Claude Code / OpenCode / Codex:** Query CLI model lists (e.g. `opencode models`, detected tool slugs).
- *Aliases:* `inherit-parent` and `auto` are always valid (they execute the role using the parent chat model).

### 2. Select Reasoning Budget
Prompt the user to select an operational reasoning budget:
- `unlimited : keep max`: Maximum reasoning effort for all thinking models.
- `large : xhigh reasoning`: High reasoning effort with reasonable token caps.
- `medium : high reasoning`: Balanced performance for day-to-day engineering.
- `small : medium reasoning`: Low/medium reasoning effort optimized for speed and maximum token conservation.

Applying a budget adjusts effort tokens (e.g. `max` > `xhigh` > `high` > `medium`) across configured models while preserving family choices.

### 3. Map Roles & Confirm
Display the current configuration table. Prompt the user to accept as-is or adjust specific roles:

| Role | Purpose | Default Family Recommendation |
|---|---|---|
| **`code`** | Core implementation, bug fixes, refactoring | Fast, high-throughput code model (e.g. Claude 3.5 Sonnet / Gemini 2.5 Flash / GPT-4o) |
| **`architect`** | Domain modeling, complex concurrency, type contracts | Deep reasoning model (e.g. Claude 3.7 Thinking / o3-mini / Gemini 2.5 Pro) |
| **`forensics`** | Code path tracing, regression archaeology | Fast search & retrieval model |
| **`reviewer`** | Adversarial review, breaking diffs before merge | Independent model family for unbiased second opinions |
| **`ui-designer`** | Visual layouts, CSS, responsive states, design tokens | Multimodal vision model |
| **`technical-writer`** | Clean documentation, commit messages, PR briefs | High-precision prose model |
| **`fast-scout`** | Large directory scans, wide grep triage | Ultra-cheap, fast model (e.g. Flash-Lite / Haiku) |
| **`product-strategist`**| Feature ideation, marketability, feasibility plans | Strategic reasoning model |

### 4. Validate & Write Configuration
Ensure all chosen slugs exist in the detected set (or use `inherit-parent` / `auto`). 

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
# budget: large (xhigh)
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
