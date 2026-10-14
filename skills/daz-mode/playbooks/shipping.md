### Shipping Playbook

Commands are shown with `gh`. On another forge use the matching row in `../references/forges.md`.

**You own what lands. Verify each PR independently, land only the contiguous verified run from the root, then keep your hands off the queue.**

A green CI badge is not a safety verdict. Never land unverified code.

---

### Execution Steps

1. **Independent Pre-Landing Verification.**
   - Do not trust green CI checks alone.
   - Run the deterministic verification command or test suite on the current branch head (**principle-prove-it-works**).
   - If UI changes are present, confirm the visual checks passed.
   - Safe means a verification verdict produced against the exact code being merged.

2. **Land Only the Contiguous Verified Run (Bottom-Up).**
   - For stacked PRs, walk up from the lowest unmerged base PR.
   - Stop at the first PR without a verified pass.
   - **Never leapfrog:** A verified PR sitting above an unverified PR is strictly unlandable. Report the ceiling PR number and state what breaks the chain.

3. **Verify the `git patch-id` Invariant.**
   - Rebasing rewrites commit hashes (SHAs) and can silently invalidate previous test passes through subtle merge conflict resolutions.
   - Record the stable `git patch-id` of the branch against `main`.
   - Before landing, confirm the current patch-id matches the verified patch-id. If the patch changed, re-verify before landing.

4. **Prepare the Lowest PR.**
   - Fetch the latest `main` branch.
   - Rebase the lowest verified branch onto the tip of `main` if needed.
   - Push and confirm mergeability using GitHub CLI:
     ```bash
     gh pr view <pr-number> --json mergeable,mergeStateStatus
     ```

5. **Land One PR at a Time.**
   - If the bottom PR is mergeable and verified, squash-merge it using the GitHub CLI:
     ```bash
     gh pr merge <pr-number> --squash --delete-branch
     ```
   - If checks are still completing on GitHub and auto-merge is configured:
     ```bash
     gh pr merge <pr-number> --squash --auto
     ```
   - Wait for the merge to complete on GitHub before touching descendant branches in the stack.

6. **Recompute the Stack After Each Merge.**
   - Fetch the updated `main`.
   - Drop the merged PR from your stack list.
   - Rebase the next PR in the stack onto `main` and repeat Steps 3 through 5.

7. **Stop at the Ceiling.**
   - When the contiguous verified run is merged, stop execution.
   - Report what landed, what remains unmerged in the stack, and what evidence is required to verify the next PR.

---

### Output Format

Reply with high information density (no conversational fluff):
- **Merged PRs:** List of PR numbers, titles, and commit SHAs merged to `main`.
- **Verified ceiling:** The highest PR verified and merged.
- **Blocked/Unmerged stack:** The next PR in the chain and the specific verification gate required to land it.
- **Evidence:** Terminal output confirming successful merge status from `gh`.
