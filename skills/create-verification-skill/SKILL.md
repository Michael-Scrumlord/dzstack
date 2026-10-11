---
name: create-verification-skill
description: "Generate a project-local verification skill that drives your app the way a user does: any language, framework, or platform. Use for /create-verification-skill, 'make a control skill for this repo', or when a project has no scripted way to prove UI/CLI/service behavior."
disable-model-invocation: true
---

# Create a Verification Skill

Every serious project needs a scripted way to drive the real app and prove behavior: launch it, exercise a feature the way a user would, and capture evidence. This skill generates that as a project-local skill (`<skills>/verify-<app>/`) tailored to the repository.

`<skills>` represents your harness's project skill folder:
- `.cursor/skills/` in Cursor
- `skills/` or `.agent/skills/` in Antigravity
- `.claude/skills/` in Claude Code
- `.agents/skills/` in Codex, OpenCode, and others

If the repo already keeps skills in one of these, use that one. Write the generator output for the next agent: it will be read cold, mid-task, by an agent that has never seen the app.

---

## 1. Interview the Repo, Not the User

Discover requirements directly from the codebase. Ask the user only what cannot be observed in code. Inspect configs (`package.json`, `Makefile`, route manifests) selectively to conserve context tokens.

- **Surface:** What does a user touch? Web UI, CLI/TUI, desktop app, API, mobile app, or library. Pick the primary surface and note secondary ones.
- **Run:** How does the app start locally? Prefer documented commands (`scripts`, `Makefile`, quickstarts). Record ports, env vars, seed data, and auth requirements.
- **Drive:** How can an agent interact programmatically? Inspect existing harnesses first (Playwright/Cypress specs, expect scripts, PTY helpers, curl endpoints, debug ports). Fall back to generic recipes: browser/CDP for web and Electron, tmux/PTY for CLI/TUI, HTTP clients for services.
- **Observe:** What evidence can be captured? Screenshots, terminal transcripts, response bodies, logs, exit codes, database state.
- **Isolate:** Can instances run side-by-side (distinct ports, temporary data directories, fresh profiles)? If not, explicitly document the single-instance constraint in the generated skill. Refusing to double-drive a shared instance is strictly better than corrupting active user sessions.

If the checkout does not build or start cleanly, fix that first (or report it precisely) before generating. A skill written against a broken base teaches wrong steps. When an irrelevant missing asset blocks startup (an empty static directory or sample config), create it as verification scaffolding and tear it down during cleanup.

---

## 2. Generate the Skill

Write `<skills>/verify-<app>/SKILL.md` with YAML frontmatter (`name: verify-<app>` and a specific description). Ground every section in codebase reality without leaving placeholders:

- **Launch:** The exact command that starts the app for verification, and how to detect readiness (log message, responding port, terminal prompt). Include teardown. For short-lived CLIs/TUIs with no persistent daemon, launch means building the binary once and running each drive in an isolated PTY/tmux session.
- **Doctor:** One read-only check answering "is this instance worth driving?" (process alive, correct build revision, port bound to our PID, valid auth). Run this first whenever behavior looks off.
- **Drive:** The harness recipe using real selectors or commands from this repository. Prefer stable handles (ARIA roles, accessible names, data attributes, prompt strings, route paths) over brittle coordinates or DOM hierarchy.
  - For web UIs, enforce the 5 mandatory UI states: default, loading, empty, error, stress, across dual viewports (1280px desktop and 375px mobile).
  - For CLIs, verify standard input, missing arguments, error exit codes, and help flags.
- **Evidence:** What artifacts to capture and their exact output paths. Adhere to strict proof standards:
  - Exercise the real user path rather than test-only internal setters.
  - Capture both the action and resulting state, not merely the final screen.
  - Verify side effects (files written, rows inserted, messages dispatched) alongside visual state.
  - Allow mocks only where a production boundary already isolates the external service.
  - When using dry-run modes, observe what they actually touch (files, network, git refs) rather than trusting parameter names.
- **Cleanup:** How to tear down instances started during the run. Never kill by broad process name; kill only the PIDs or containers created by this run. Teardown removes processes and scratch state, but never evidence artifacts. Proof artifacts must survive cleanup in the designated path.
- **Helpers:** Any script shipped with the skill must be executable (`chmod +x`) with its invocation documented in the skill body.

---

## 3. Seed the Feature Map

Create `<skills>/verify-<app>/features/README.md` plus one file per user-facing feature (aim for the top 3-5 to start, sourced from routes, CLI subcommands, or docs). Follow the template in [`references/feature-map-example/`](references/feature-map-example/):

Each feature file starts with an H1 title and a single summary paragraph, followed by exactly four H2 sections in order:
1. `Sub-features`: Short identifiers paired with a single-line behavior summary.
2. `How to get to it (user POV)`: Every valid user entry point.
3. `Driving it with <harness>`: Begins with `Preconditions:` followed by labeled bullets matching user actions with exact commands and observable results.
4. `Gotchas`: Traps, timing quirks, or state edge-cases that could invalidate a run.

Keep implementation details out of the map. Focus entirely on user paths, stable handles, required state, and observable proof.

---

## 4. Prove the Generated Skill Before Handing It Over

Execute the generated instructions end-to-end once:
1. Launch the app.
2. Run `doctor`.
3. Drive ONE mapped feature completely.
4. Capture proof evidence.
5. Execute cleanup.

After cleanup, confirm the evidence artifacts still exist on disk. A cleanup routine that deletes proof artifacts is broken. Fix any failures and run cleanup after failed iterations to avoid stranding zombie processes or blocked ports. A generated skill that was never executed is a draft, not a deliverable.

---

## 5. Offer the Maintenance Loop

Direct the user to `/maintain-verification-skill` to keep the feature map synchronized as the codebase evolves. Suggest an audit cadence only if requested.
