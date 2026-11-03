# dzstack evals

Realistic coding tasks with hidden checks, run against several **arms** (no skill pack, dzstack at any git ref, other packs such as pstack) on any of several **agents**: Claude Code, OpenAI Codex, the Antigravity CLI (`agy`, Gemini CLI's successor), and OpenCode with any OpenAI-compatible model, local ones included. The harness reports pass rate, score, cost, tokens, turns, time and diff size for each arm. Use it to answer two questions with numbers: is dzstack better than the alternatives, and is this change to dzstack an improvement?

## How a run works

- **Isolation.** Each run starts a fresh Docker container (`harness/Dockerfile`), as a non-root user, with only that run's workspace mounted. The workspace is a git repository made from the case's `repo/`. Claude Code runs headless (`claude -p`, `bypassPermissions`), with no user settings, CLAUDE.md, MCP servers or other plugins.
- **The arm.** In Claude Code the arm's pack loads as a plugin (`--plugin-dir`), so its hooks run too. Every other agent gets the pack's `skills/` folder at `~/.agents/skills`, the Agent Skills folder Codex, Antigravity and OpenCode all read. The arm's prompt prefix goes in front of the task. It can differ per agent: dzstack uses `/daz-mode` in Claude Code and "Use the daz-mode skill" elsewhere.
- **Grading.** Whatever agent ran, grading is the same. When the agent stops, `check.sh` runs in a second container with no network. It reads the result read-only and the case's hidden files, and prints one JSON line per check. Cases that need judgment (a review, an explanation) also have a `rubric.md`, which a separate model call grades with no tools.
- **Scoring.** **pass** means every required check passed. **score** is the weighted share of all checks that passed. Cost and tokens come from Claude Code's own result record. Cost is the list-price equivalent: a subscription run spends usage, not dollars.
- **Caching.** A result is cached by agent and CLI version, arm content, prefix, case content, model, effort and run index. Re-running a comparison pays only for what changed.

## Agents

| `--agent` | CLI (pinned in `harness/Dockerfile`) | `--model` | Credentials in `~/.config/agent-evals/` |
|---|---|---|---|
| `claude` (default) | Claude Code | `sonnet`, `opus`, `haiku`, … (default `sonnet`) | `claude-oauth-token`: from `claude setup-token` (a subscription) |
| `codex` | OpenAI Codex CLI, `codex exec` | the model name, or the CLI's default | `.codex/auth.json` (a ChatGPT sign-in) or `openai-api-key` |
| `agy` | Antigravity CLI, `agy -p` | a name from `agy models` | `gemini-api-key`, or a signed-in `.gemini/` folder |
| `opencode` | OpenCode, `opencode run` | `provider/model` from your config | `opencode.json` with the provider: any OpenAI-compatible endpoint, such as Ollama, LM Studio or llama.cpp's server |

- **Credentials.** Make each file mode 600. `run.py agents` says which agents are ready. A sign-in that the CLI refreshes (Codex's `auth.json`, a `.gemini/` folder) is copied into each run and copied back, so those agents run one at a time.
- **Rubric grading.** Cases with a rubric are graded by Claude whatever agent ran them, so a Claude token is needed for those.
- **Extra flags.** `--effort` maps to each CLI's own reasoning-effort flag. `--agent-arg` passes anything else, repeatable. For example, Codex on a local model: `--agent codex --agent-arg=--oss --model <name>`.
- **Local models.** The container must reach the endpoint, and the model needs tool calling and a context of 32k or more, because the agent CLIs' own instructions take 10-20k tokens. A 4-8B model on a 6 GB GPU runs the harness but rarely finishes these tasks. A 30B coding model needs about 24 GB.
- **Counts across agents.** Tokens are counted the way each CLI reports them. Cost comes only from Claude Code and OpenCode. "Turns" counts model turns in Claude Code and tool calls elsewhere, so compare turns only within one agent.

## Arms

`arms.json` holds the defaults: `vanilla`, `dzstack` (this repository at `HEAD`, engaged with `/daz-mode`) and `pstack` (the Claude Code port at a pinned commit). Add arms on the command line as `--arm 'id=SOURCE|PREFIX'`, where SOURCE is one of:
- `none`;
- `git:<ref>`: this repository at any commit, branch or tag;
- `git+<url>@<commit>:<subdir>`;
- `dir:<path>`.

## Use it (in the dev container)

```bash
cd ~/dzstack-evals                       # a clone or rsync of this repository
python3 evals/harness/run.py build       # the image, once per Claude Code version
python3 evals/harness/run.py selftest    # every case fails on its fixture and passes with its solution
python3 evals/harness/run.py run --tag quick --model haiku --runs 2 --max-usd 5
python3 evals/harness/run.py run --model sonnet --runs 3            # the full suite
python3 evals/harness/run.py run --arms vanilla --arm 'old=git:main|/daz-mode ' --arm 'new=git:HEAD|/daz-mode '
python3 evals/harness/run.py run --agent codex --tag quick --runs 2     # the same arms on Codex
python3 evals/harness/run.py report evals/results/<claude-run> evals/results/<codex-run>   # side by side
python3 evals/harness/run.py report evals/results/<run>             # tables again
```

- **Sign in.** See Agents above. A Claude subscription token can also stay in the older `~/.config/claude-eval/oauth-token`. The harness passes credentials to each container through the environment or a private copy, and never prints them. It also drops `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY` from the run's environment, so a run never bills a key you didn't put in the credentials folder.
- **Results.** Each run writes `evals/results/<timestamp>/`, which is git-ignored. It holds one folder per run (transcript, diff, final message, checks) and `results.jsonl`.

## Reading the numbers

- Model runs vary. With 2 or 3 runs per case, trust a difference only when it holds across most cases. The report prints how many cases an arm won, lost and tied against the first arm, plus a bootstrap interval for the mean score difference. An interval that crosses zero is not a result.
- Compare cost and turns, not only pass rate. A skill pack that passes the same cases at half the cost is better.
- "Skills invoked" shows whether an arm's skills actually fired. "Plugins loaded" shows whether the plugin loaded at all. Check both before believing an arm's numbers.
- A prompt prefix such as `/daz-mode` expands the skill into the prompt. It doesn't show as a Skill call, so "Skills invoked" lists only the skills the agent loaded itself. `/daz-mode` resolves to the plugin's `dzstack:daz-mode` (checked 2026-11-02 by asking the model to quote the skill's first rule). pstack's SessionStart hook shows as `hook_response` events in the transcript.

## Adding a case

A case is a folder in `cases/`, named for what it tests:

| File | What it holds |
|---|---|
| `case.json` | `title`, `kind` (bug-fix, feature, refactor, perf, security, review, question, no-change), `tags` (`quick` for the small comparison set; the language), `max_turns`, `timeout_s`, and `judge_files` when a rubric needs to see files the agent wrote |
| `task.md` | the request exactly as a person would type it. Mention how to run the tests if a newcomer couldn't tell |
| `repo/` | the fixture project: small (a few hundred lines), realistic, with a README and its own passing tests. Only what the image has: Node 24 (TypeScript runs natively; imports use `.ts` extensions; `node --test`), Python 3.11 with pytest, git, jq. No package installs |
| `hidden/` | tests and data the agent never sees |
| `check.sh` | sources `/harness/lib.sh` and calls `check <name> <weight> <required> <command>` per check (see `cases/ts-pagination-last-page/check.sh`) |
| `rubric.md` | optional: one `- ` line per criterion for the model grader, only for what a script can't check |
| `solution.patch` | a reference solution as a `git apply` patch. `selftest` requires the fixture to fail a required check and the solution to pass every required one |

Rules that keep the comparison fair:
- The task states the behavior a hidden check verifies, or the fixture's README or code documents it. No hidden check tests something a careful engineer couldn't know.
- The task never names a method that one arm teaches ("write a failing test first", "use TDD", "prove it"). Checks reward the outcome, such as a regression test that fails on the original code, never the wording.
- Required checks cover correctness. Non-required checks cover craft: a regression test, scope, diff size, the quality of the explanation.
