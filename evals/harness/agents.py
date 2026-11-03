"""Agent adapters: how each coding-agent CLI runs headless in the eval image, gets an
arm's skill pack, signs in, and reports what it used.

  claude    Claude Code. A pack loads as a plugin (--plugin-dir), so its hooks run too.
  codex     OpenAI Codex CLI (`codex exec`). Local models: --agent-arg=--oss, or a
            provider set with --agent-arg=-c --agent-arg=model_providers.<id>.base_url=...
  agy       Antigravity CLI, the successor to Gemini CLI.
  opencode  OpenCode, for any OpenAI-compatible endpoint, local ones included, set in
            its opencode.json.

Every agent except Claude gets the pack's skills/ folder at ~/.agents/skills, the
shared Agent Skills folder that Codex, Antigravity and OpenCode all read.

Credentials live in $DZ_EVALS_CREDS (default ~/.config/agent-evals), one file or
folder per agent, mode 600. Each run gets its own copy in a private home, and a
refreshed sign-in is copied back, so OAuth agents run one at a time.
"""
import hashlib, json, os, re, shutil, threading
from pathlib import Path

DOCKERFILE = (Path(__file__).parent / "Dockerfile").read_text()
IMAGE = "dzstack-evals:" + hashlib.sha256(DOCKERFILE.encode()).hexdigest()[:12]
CREDS = Path(os.environ.get("DZ_EVALS_CREDS", Path.home() / ".config/agent-evals"))
HOME = "/home/node"
_save_lock = threading.Lock()


def _version(arg):
    return re.search(rf"{arg}=(\S+)", DOCKERFILE).group(1)


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def _events(out):
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                yield json.loads(line)
            except ValueError:
                pass


def _blank():
    return {"tools": {}, "skills": [], "plugins": [], "input_tokens": 0, "output_tokens": 0,
            "cache_read_tokens": 0, "cache_write_tokens": 0, "cost_usd": None, "turns": None,
            "duration_s": None, "agent_error": None, "stop": None}


class Agent:
    name = version = ""
    revision = 1  # bump when the adapter's flags or parsing change, so cached results aren't reused
    default_model = None
    oauth_file = None  # a credentials path under CREDS that the CLI refreshes in place

    def available(self):
        return True

    def max_jobs(self):
        return 1 if self.oauth_file and (CREDS / self.oauth_file).exists() else None

    def mounts(self, plugin_dir):
        """Docker args and CLI args that load an arm's skill pack."""
        if plugin_dir and (Path(plugin_dir) / "skills").is_dir():
            return ["-v", f"{Path(plugin_dir) / 'skills'}:{HOME}/.agents/skills:ro"], []
        return [], []

    def auth(self, home: Path):
        """Copy credentials into the run's private home; return (docker args, env)."""
        return [], {}

    def infra_error(self, stdout: str, stderr: str):
        """'quota' (stop the pass), 'transient' (retry) or None, when the provider, not the
        agent, ended the run. Such a run is never scored or cached."""
        text = (stdout[-4000:] + stderr[-4000:]).lower()
        if re.search(r"usage_limit_reached|resource_exhausted|quota|rate[ _-]?limit|\b429\b", text):
            return "quota"
        if re.search(r"overloaded|no capacity|unavailable|\b50[234]\b|\b529\b", text):
            return "transient"
        return None

    def collect(self, home: Path, work: Path, task: str):
        """Files the agent produced outside the workspace that belong in it; returns their names."""
        return []

    def save_back(self, home: Path):
        if not self.oauth_file:
            return
        src, dst = home / self.oauth_file, CREDS / self.oauth_file
        with _save_lock:
            if src.is_file() and dst.is_file() and src.read_bytes() != dst.read_bytes():
                shutil.copy2(src, dst)

    def _copy_in(self, home, rel, target):
        """Copy CREDS/rel (file or folder) into home/rel and mount it at target."""
        src = CREDS / rel
        dst = home / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst)
            mount = dst
        else:
            shutil.copy2(src, dst)
            mount = dst.parent
        return ["-v", f"{mount}:{target}"]


class Claude(Agent):
    name, default_model = "claude", "sonnet"
    version = _version("CLAUDE_CODE_VERSION")

    def token(self):
        for f in (CREDS / "claude-oauth-token", Path.home() / ".config/claude-eval/oauth-token"):
            if f.exists():
                return f.read_text().strip()
        return None

    def available(self):
        return bool(self.token())

    def mounts(self, plugin_dir):
        if not plugin_dir:
            return [], []
        return ["-v", f"{plugin_dir}:/plugin:ro"], ["--plugin-dir", "/plugin"]

    def infra_error(self, stdout, stderr):
        res = next((e for e in _events(stdout) if e.get("type") == "result"), None)
        status = (res or {}).get("api_error_status")
        if status == 429 or (res or {}).get("api_error") == "usage_limit_reached":
            return "quota"
        if status in (500, 502, 503, 529):
            return "transient"
        return None if res else Agent.infra_error(self, "", stderr)

    def auth(self, home):
        tok = self.token()
        if not tok:
            raise SystemExit(f"no Claude token: put one in {CREDS}/claude-oauth-token (evals/README.md, 'Sign in')")
        return ["-e", "CLAUDE_CODE_OAUTH_TOKEN", "-e", "DISABLE_AUTOUPDATER=1",
                "-e", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1"], {"CLAUDE_CODE_OAUTH_TOKEN": tok}

    def command(self, prompt, model, case, effort, extra):
        cmd = ["claude", "-p", prompt, "--model", model, "--output-format", "stream-json", "--verbose",
               "--max-turns", str(case.get("max_turns", 40)), "--permission-mode", "bypassPermissions",
               "--no-session-persistence"]
        if effort:
            cmd += ["--effort", effort]
        return cmd + list(extra)

    def parse(self, out, outdir):
        rec, final = _blank(), ""
        for ev in _events(out):
            if ev.get("type") == "system" and ev.get("subtype") == "init":
                rec["plugins"] = [p.get("name") for p in ev.get("plugins", [])]
            if ev.get("type") == "assistant":
                for c in ev.get("message", {}).get("content", []):
                    if c.get("type") == "tool_use":
                        rec["tools"][c["name"]] = rec["tools"].get(c["name"], 0) + 1
                        if c["name"] == "Skill":
                            rec["skills"].append(c.get("input", {}).get("skill") or c.get("input", {}).get("command"))
            if ev.get("type") == "result":
                u = ev.get("usage", {})
                rec.update(cost_usd=ev.get("total_cost_usd"), turns=ev.get("num_turns"),
                           duration_s=round((ev.get("duration_ms") or 0) / 1000, 1), agent_error=ev.get("is_error"),
                           stop=ev.get("subtype"), input_tokens=u.get("input_tokens", 0),
                           output_tokens=u.get("output_tokens", 0),
                           cache_read_tokens=u.get("cache_read_input_tokens", 0),
                           cache_write_tokens=u.get("cache_creation_input_tokens", 0))
                final = ev.get("result") or ""
        rec["finished"] = rec["turns"] is not None
        return rec, final


class Codex(Agent):
    name = "codex"
    version = _version("CODEX_VERSION")
    oauth_file = ".codex/auth.json"  # a ChatGPT sign-in: copy ~/.codex/auth.json here

    def available(self):
        return (CREDS / self.oauth_file).exists() or (CREDS / "openai-api-key").exists()

    def auth(self, home):
        if (CREDS / self.oauth_file).exists():
            return self._copy_in(home, self.oauth_file, f"{HOME}/.codex"), {}
        if (CREDS / "openai-api-key").exists():
            key = (CREDS / "openai-api-key").read_text().strip()
            return ["-e", "OPENAI_API_KEY", "-e", "CODEX_API_KEY"], {"OPENAI_API_KEY": key, "CODEX_API_KEY": key}
        return [], {}  # a local provider needs no sign-in

    def command(self, prompt, model, case, effort, extra):
        cmd = ["codex", "exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check",
               "-C", "/work", "-o", "/out/final.md", "-c", "check_for_update_on_startup=false"]
        if model:
            cmd += ["-m", model]
        if effort:
            cmd += ["-c", f"model_reasoning_effort={effort}"]
        return cmd + list(extra) + [prompt]

    def parse(self, out, outdir):
        rec, final, turns = _blank(), "", 0
        for ev in _events(out):
            t = ev.get("type", "")
            if t == "turn.completed":
                u = ev.get("usage", {})
                cached = u.get("cached_input_tokens", 0)
                rec["input_tokens"] += u.get("input_tokens", 0) - cached
                rec["cache_read_tokens"] += cached
                rec["output_tokens"] += u.get("output_tokens", 0)
                rec["stop"] = "success"
            elif t in ("turn.failed", "error"):
                rec["agent_error"], rec["stop"] = True, t
            elif t == "item.completed":
                item = ev.get("item", {})
                kind = item.get("type") or item.get("item_type")
                if kind == "agent_message":
                    final = item.get("text") or final
                elif kind and kind not in ("reasoning", "user_message"):
                    turns += 1
                    rec["tools"][kind] = rec["tools"].get(kind, 0) + 1
        f = outdir / "final.md"
        if f.exists() and f.read_text().strip():
            final = f.read_text()
        rec["turns"] = turns
        rec["agent_error"] = bool(rec["agent_error"])
        rec["finished"] = rec["stop"] == "success"
        return rec, final


class Antigravity(Agent):
    name = "agy"
    revision = 2  # 2: --mode auto; documents the task names are recovered from agy's artifact folder
    version = _version("AGY_VERSION")
    oauth_file = ".gemini"  # a signed-in ~/.gemini folder, if not using an API key

    def available(self):
        return (CREDS / "gemini-api-key").exists() or (CREDS / self.oauth_file).is_dir()

    def max_jobs(self):
        return None  # a Google refresh token isn't rotated, so parallel copies don't log each other out

    def auth(self, home):
        if (CREDS / "gemini-api-key").exists():
            return ["-e", "GEMINI_API_KEY"], {"GEMINI_API_KEY": (CREDS / "gemini-api-key").read_text().strip()}
        if (CREDS / self.oauth_file).is_dir():
            return self._copy_in(home, self.oauth_file, f"{HOME}/.gemini"), {}
        raise SystemExit(f"no Antigravity sign-in: put an API key in {CREDS}/gemini-api-key")

    def save_back(self, home):
        pass  # a copied ~/.gemini is used as is; sign in again if it expires

    def infra_error(self, stdout, stderr):
        m = re.search(r"AGY_ERROR: (\{.*\})", stderr)
        if not m:
            return None
        try:
            err = json.loads(m.group(1))
        except ValueError:
            return Agent.infra_error(self, "", m.group(1))
        if err.get("error_code") == 429 or err.get("status") == "RESOURCE_EXHAUSTED":
            return "quota"
        if err.get("retryable") or err.get("error_code") in (500, 502, 503):
            return "transient"
        return None

    def collect(self, home, work, task):
        # agy saves documents it writes (a review, notes) as artifacts in its own brain folder,
        # not in the project. A file the task asks for by name is copied into the workspace.
        brain = home / ".gemini/antigravity-cli/brain"
        wanted = set(re.findall(r"\b[\w.-]+\.(?:md|txt|json|csv)\b", task))
        found = []
        for name in sorted(wanted):
            if (work / name).exists():
                continue
            hits = sorted(brain.glob(f"*/{name}"), key=lambda f: f.stat().st_mtime)
            if hits:
                shutil.copy2(hits[-1], work / name)
                found.append(name)
        return found

    def command(self, prompt, model, case, effort, extra):
        cmd = ["agy", "-p", prompt, "--output-format", "stream-json", "--dangerously-skip-permissions", "--mode", "auto"]
        if model:
            cmd += ["--model", model]
        if effort:
            cmd += ["--effort", effort]
        return cmd + list(extra)

    def parse(self, out, outdir):
        # agy's stream-json (1.4.x): {"event": "init"}, many {"event": "step_update"} (step_type
        # tool / agent_response / user_input, state ACTIVE then DONE, no tool names), and one
        # {"event": "result"} with status, response, duration_seconds and usage.
        rec, final, tool_steps = _blank(), "", set()
        for ev in _events(out):
            kind = ev.get("event")
            if kind == "step_update":
                st = ev.get("step_update", {})
                if st.get("step_type") == "tool" and st.get("state") == "DONE":
                    tool_steps.add(st.get("step_index"))
            elif kind == "result":
                r = ev.get("result", {})
                u = r.get("usage", {})
                rec.update(input_tokens=u.get("input_tokens", 0),
                           output_tokens=u.get("output_tokens", 0) + u.get("thinking_tokens", 0),
                           cache_read_tokens=u.get("cache_read_tokens", 0),
                           duration_s=round(r.get("duration_seconds") or 0, 1),
                           stop=(r.get("status") or "").lower() or None)
                rec["agent_error"] = rec["stop"] != "success"
                final = r.get("response") or ""
        rec["tools"] = {"tool": len(tool_steps)} if tool_steps else {}
        rec["turns"] = len(tool_steps)
        rec["finished"] = rec["stop"] == "success"
        return rec, final


class OpenCode(Agent):
    name = "opencode"
    version = _version("OPENCODE_VERSION")

    def available(self):
        return (CREDS / "opencode.json").exists()

    def auth(self, home):
        if not (CREDS / "opencode.json").exists():
            raise SystemExit(f"no OpenCode config: put an opencode.json with your provider in {CREDS}/")
        dst = home / ".config/opencode"
        dst.mkdir(parents=True)
        shutil.copy2(CREDS / "opencode.json", dst / "opencode.json")
        return ["-v", f"{dst}:{HOME}/.config/opencode"], {}

    def command(self, prompt, model, case, effort, extra):
        cmd = ["opencode", "run", "--format", "json", "--auto", "--dir", "/work"]
        if model:
            cmd += ["-m", model]
        if effort:
            cmd += ["--variant", effort]
        return cmd + list(extra) + [prompt]

    def parse(self, out, outdir):
        rec, final, cost = _blank(), "", 0.0
        for ev in _events(out):
            part = ev.get("part", ev)
            kind = ev.get("type") or part.get("type")
            if kind in ("step_finish", "step-finish"):
                tok = part.get("tokens", {})
                rec["input_tokens"] += tok.get("input", 0)
                rec["output_tokens"] += tok.get("output", 0) + tok.get("reasoning", 0)
                rec["cache_read_tokens"] += tok.get("cache", {}).get("read", 0)
                rec["cache_write_tokens"] += tok.get("cache", {}).get("write", 0)
                cost += part.get("cost") or 0
                rec["stop"] = "success"
            elif kind in ("tool_use", "tool") and isinstance(part.get("tool"), str):
                rec["tools"][part["tool"]] = rec["tools"].get(part["tool"], 0) + 1
            elif kind == "text" and isinstance(part.get("text"), str):
                final = part["text"]
            elif kind == "error":
                rec["agent_error"], rec["stop"] = True, "error"
        rec["cost_usd"] = cost or None
        rec["turns"] = sum(rec["tools"].values())
        rec["finished"] = rec["stop"] == "success"
        return rec, final


AGENTS = {a.name: a for a in (Claude(), Codex(), Antigravity(), OpenCode())}


def prefix_for(arm, agent):
    """An arm's prompt prefix: one string, or {"claude": "...", "*": "..."} per agent."""
    p = arm.get("prefix", "")
    if isinstance(p, dict):
        return p.get(agent, p.get("*", ""))
    return p
