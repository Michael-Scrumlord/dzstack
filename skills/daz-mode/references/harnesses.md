# Harness Adapter Reference

`dzstack` is provider-agnostic and harness-agnostic. Match the active environment using the tables below.

## 1. Skill & Model Config Paths

| Harness | Project Skills | User Skills | Model Config |
|---|---|---|---|
| **Cursor** | `.cursor/skills/` | `~/.cursor/skills/` | `~/.cursor/rules/daz-models.mdc` |
| **Antigravity** | `skills/` or `.agent/skills/` | `~/.gemini/config/skills/` or `~/.agents/skills/` | `~/.agents/daz-models.md` |
| **Claude Code** | `.claude/skills/` | `~/.claude/skills/` | `~/.agents/daz-models.md` |
| **Codex** | `.agents/skills/` | `~/.codex/skills/` or `~/.agents/skills/` | `~/.agents/daz-models.md` |
| **OpenCode** | `.agents/skills/` | `~/.config/opencode/skills/` or `~/.agents/skills/` | `~/.agents/daz-models.md` |
| **Pi** | `.pi/skills/` | `~/.pi/agent/skills/` | `~/.agents/daz-models.md` |

## 2. Workspace Session Transcripts

**Workspace Boundary Rule:** Only read transcripts belonging to the active workspace. Never glob across multiple project directories, as that crosses workspace boundaries and exposes unrelated private chats.

| Harness | Active Workspace Transcript Path |
|---|---|
| **Cursor** | `~/.cursor/projects/<slug>/agent-transcripts/` (`<id>.jsonl`, `<id>/<id>.jsonl`, or `<parent>/subagents/<child>.jsonl`), where `<slug>` drops the leading `/` and replaces `/` with `-`. |
| **Antigravity** | `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` (and `transcript_full.jsonl` when `truncated_fields` is present). |
| **Claude Code** | `~/.claude/projects/<slug>/<session-id>.jsonl`, where `<slug>` replaces every non-alphanumeric character in the workspace path with `-`. |
| **Codex** | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (filter to files whose first line has `payload.cwd` equal to the active workspace path). |
| **OpenCode** | `~/.local/share/opencode/storage/session/<project-id>/` (messages under `message/` and `part/`). |
| **Pi** | `~/.pi/agent/sessions/--<slug>--/<timestamp>_<id>.jsonl`, where `<slug>` drops the leading `/` and replaces `/` with `-`. |

## 3. Subagent & Question Tool Mapping

| Capability | Cursor | Antigravity | Claude Code | Codex | OpenCode | Single-Threaded Fallback |
|---|---|---|---|---|---|---|
| **Subagent spawn** | `Task` (`subagent_type: "daz-agent"` or `"generalPurpose"`) | `invoke_subagent` (`TypeName: "self"`; the prompt reads `~/.claude/agents/daz-agent.md`) | `Agent` (`subagent_type: "daz-agent"` or `"general-purpose"`) | `spawn_agent` | `task` (`subagent_type: "general"`) | Execute steps sequentially in the main agent. |
| **Structured question** | `AskQuestion` | `ask_question` | `AskUserQuestion` | Numbered options in chat | `question` | Numbered options in chat. |
