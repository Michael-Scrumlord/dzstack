### Opening a PR Playbook

Commands are shown with `gh`. On another forge use the matching row in `../references/forges.md`.

Invoked at the end of every coding playbook (`feature`, `bug-fix`, `refactoring`, `ui-parity`).

---

### Execution Steps

1. **Clean Worktree Isolation.**
   - Ensure work is executed from a clean git worktree or branch off `main`.
   - Never mix unrelated edits or dirty working tree state into a feature PR.

2. **Atomic Commits & Conventional Commits Title.**
   - Rebase into small, ordered commits before opening the PR.
   - Stage commits in atomic, verifiable units (**principle-sequence-verifiable-units**).
   - Use Conventional Commits in the format `type(scope): subject`:
     - Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.
     - Scope names the affected module (e.g. `auth`, `ui`, `core`).
     - Subject is imperative, concise, and contains **no trailing period** (e.g., `feat(auth): add refresh token rotation`).

3. **Pre-Review Quality & Hygiene.**
   - Run `/no-comments` to purge play-by-play comment narration and dead code corpses.
   - Preserve canonical educational pattern tags (`// Pattern: <Name> - <why>`).
   - Run `/unslop` to eliminate conversational padding, long dashes, and AI vocabulary from commit messages and PR descriptions.

4. **The 40-Line Executive Briefing.**
   The PR body is an executive briefing for the reviewer, not a development lab notebook. Keep the entire description under 40 lines.

   Use these five sections in order (omit a section only if it has nothing to report):
   - `## Why`: 1–2 short paragraphs explaining intent and business problem solved.
   - `## Scope`: Compact bulleted list of modified symbols, files, and public contracts.
   - `## Tradeoffs`: Key rejected alternatives and why they were declined.
   - `## Blast Radius`: 1–3 sentences naming what this touches, breaking change risks, and rollback safety.
   - `## Verification`: Terminal or runtime proof (`before → after` output, test results, or viewport check confirmation).

5. **Open via GitHub CLI (`gh`).**
   - Create the PR in ready state (never draft):
     ```bash
     gh pr create --title "<type(scope): subject>" --body-file <briefing-file>
     ```
   - For stacked PRs targeting a parent branch:
     ```bash
     gh pr create --base <parent-branch> --title "<title>" --body-file <briefing-file>
     ```

6. **Post URL & Exit Cleanly.**
   - Post the pull request URL in the terminal reply.
   - Do not enter a background polling loop watching CI. Complete the turn and return control to the operator.
