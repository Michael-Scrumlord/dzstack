# Forges: where PRs, reviews and CI live

Resolve the forge once per task, from the repository itself, then use it for every PR, review, CI and merge step. Playbooks show `gh` commands; on another forge use the equivalent row below. Never require Graphite (`gt`). Never push to a forge other than the one `origin` points at.

## Resolve

1. `git remote get-url origin`.
2. Match the first row that fits:

| Origin | Forge | Use |
|---|---|---|
| `github.com` | GitHub | `gh` |
| a host Cursor's Origin can resolve (`command -v origin` succeeds and `origin repo view` works) | Origin | `origin pr …` |
| a Gitea host or SSH alias (the API answers at `/api/v1/version`) | Gitea | the `gitea` MCP if the session has it, else `tea`, else the REST API |
| anything else | unknown | stop and ask which forge, once |

3. Record the choice in the task's trail (one line), so a resumed session does not resolve it again.

## Equivalents

| Step | GitHub (`gh`) | Gitea MCP | Gitea REST (`/api/v1/repos/{owner}/{repo}`) |
|---|---|---|---|
| Open a PR | `gh pr create --base B --title T --body-file F` | `pull_request_write` method `create` | `POST /pulls` `{base, head, title, body}` |
| Read state | `gh pr view N --json mergeable,mergeStateStatus` | `pull_request_read` method `get` | `GET /pulls/N` (`mergeable`) |
| Review threads | `gh pr view N --comments` | `pull_request_read` methods `get_reviews`, `get_review_comments` | `GET /pulls/N/reviews` |
| CI result | `gh pr checks N` | `pull_request_read` method `get_status` (`wait_seconds` up to 45); job logs with `actions_run_read` | `GET /actions/runs?head_sha=SHA` |
| Merge (squash) | `gh pr merge N --squash --delete-branch` | `pull_request_write` method `merge`, `merge_style: squash`, `delete_branch: true`, `head_commit_id` = the verified SHA | `POST /pulls/N/merge` `{"Do":"squash","delete_branch_after_merge":true}` |
| Auto-merge when green | `gh pr merge N --squash --auto` | `pull_request_write` method `merge`, `merge_when_checks_succeed: true` | `POST /pulls/N/merge` `{"Do":"squash","merge_when_checks_succeed":true}` |

Tokens for REST calls are piped into the request, never printed or written to a file in the repo (`… | sed 's/^/Authorization: token /' | curl -H @- …`).

## Notes

- Gitea has no hosted review bot. Bugbot triage (`bugbot-triage.md`) applies to human review threads there; skip the bot-specific rules.
- Pass `head_commit_id` on every merge: the forge then refuses if the head moved after your verdict (the patch-id rule in `../playbooks/shipping.md`).
- A push is done when the forge's CI for that commit passes, not when the push returns.
