#!/usr/bin/env python3
"""Run dzstack's eval cases against several arms (no skill pack, dzstack at any git
ref, other packs), on any of several coding agents (Claude Code, Codex, Antigravity,
OpenCode with any OpenAI-compatible model, local ones included; see agents.py), and
report pass rate, cost, tokens, turns and time.

  run.py build                              build the eval image
  run.py selftest [--case GLOB]             prove each case: the fixture fails its
                                            checks, the reference solution passes
  run.py run [--agent claude|codex|agy|opencode] [--model M] [--effort E]
             [--agent-arg ARG ...] [--arms a,b] [--arm id=SRC|PREFIX] [--runs N]
             [--case GLOB] [--tag T] [-j N] [--max-usd X] [--judge-model M]
  run.py agents                             which agents have credentials here
  run.py report [RUN_DIR...]                tables for one or more run folders

Every agent run happens in its own container, as a non-root user, with only its
workspace mounted. Results are cached by (agent and its version, arm content,
case content, model, run index), so an unchanged arm is never paid for twice.
Rubric cases are graded by Claude, whichever agent ran them.
"""
import argparse, concurrent.futures as cf, fnmatch, hashlib, json, os, random, re
import shutil, statistics, subprocess, sys, tempfile, threading, time, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agents import AGENTS, IMAGE, prefix_for  # noqa: E402

EVALS = Path(__file__).resolve().parent.parent
REPO = EVALS.parent
STATE = Path(os.environ.get("DZ_EVALS_STATE", Path.home() / ".cache/dzstack-evals"))
CC_VERSION = AGENTS["claude"].version
lock = threading.Lock()


def sh(cmd, **kw):
    kw.setdefault("check", True)
    kw.setdefault("capture_output", True)
    kw.setdefault("text", True)
    return subprocess.run(cmd, **kw)


def tree_hash(path: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(p for p in path.rglob("*") if p.is_file() and "results" not in p.relative_to(path).parts):
        h.update(str(f.relative_to(path)).encode() + b"\0" + f.read_bytes() + b"\0")
    return h.hexdigest()[:16]


# ---------- arms ----------

def resolve_plugin(src: str | None) -> tuple[Path | None, str]:
    """Return (plugin dir, content key) for an arm's plugin source."""
    if not src or src == "none":
        return None, "none"
    snaps = STATE / "plugins"
    snaps.mkdir(parents=True, exist_ok=True)
    if src.startswith("git:"):
        ref = src[4:]
        tree = sh(["git", "-C", str(REPO), "rev-parse", f"{ref}^{{tree}}"]).stdout.strip()[:16]
        out = snaps / f"self-{tree}"
        if not out.exists():
            tmp = Path(tempfile.mkdtemp(dir=snaps))
            arch = subprocess.run(["git", "-C", str(REPO), "archive", ref], check=True, capture_output=True).stdout
            subprocess.run(["tar", "-x", "-C", str(tmp)], input=arch, check=True)
            shutil.rmtree(tmp / "evals", ignore_errors=True)  # an arm never sees the eval cases
            manifest = tmp / ".claude-plugin/plugin.json"
            if not manifest.exists():
                manifest.parent.mkdir(parents=True, exist_ok=True)
                manifest.write_text(json.dumps({"name": "dzstack", "version": "0.0.0",  # stable: the key is the content
                                                "description": "dzstack skills"}))
            tmp.rename(out)
        return out, f"plugin:{tree_hash(out)}"  # by content, so commits that touch only evals/ reuse results
    if src.startswith("git+"):
        m = re.fullmatch(r"git\+(.+)@([0-9a-fA-F]+):(.*)", src)
        if not m:
            sys.exit(f"plugin source {src!r}: use git+<url>@<commit>:<subdir>")
        url, rev, sub = m.groups()
        out = snaps / f"{re.sub(r'[^A-Za-z0-9]+', '-', url)[-40:]}-{rev[:12]}-{sub.replace('/', '-')}"
        if not out.exists():
            clone = snaps / ("clone-" + hashlib.sha256(url.encode()).hexdigest()[:12])
            if not clone.exists():
                sh(["git", "clone", "-q", "--filter=blob:none", url, str(clone)])
            sh(["git", "-C", str(clone), "fetch", "-q", "origin", rev], check=False)
            tmp = Path(tempfile.mkdtemp(dir=snaps))
            arch = subprocess.run(["git", "-C", str(clone), "archive", f"{rev}:{sub}"], check=True, capture_output=True).stdout
            subprocess.run(["tar", "-x", "-C", str(tmp)], input=arch, check=True)
            tmp.rename(out)
        return out, f"{url}@{rev[:12]}:{sub}"
    if src.startswith("dir:"):
        p = Path(src[4:]).expanduser().resolve()
        return p, f"dir:{tree_hash(p)}"
    sys.exit(f"unknown plugin source {src!r} (none, git:<ref>, git+<url>@<commit>:<subdir>, dir:<path>)")


def load_arms(names, extra):
    table = {a["id"]: a for a in json.loads((EVALS / "arms.json").read_text())}
    if names == ["none"]:  # only the arms given with --arm
        names = []
        arms = []
    else:
        arms = [table[n] for n in names] if names else list(table.values())
    for spec in extra:
        ident, _, rest = spec.partition("=")
        src, _, prefix = rest.partition("|")
        arms.append({"id": ident, "plugin": src, "prefix": prefix})
    for a in arms:
        a["dir"], a["key"] = resolve_plugin(a.get("plugin"))
    return arms


# ---------- cases ----------

def load_cases(glob="*", tag=None, skip=()):
    cases = []
    for d in sorted((EVALS / "cases").iterdir()):
        if not (d / "case.json").exists() or not fnmatch.fnmatch(d.name, glob):
            continue
        if any(fnmatch.fnmatch(d.name, g) for g in skip):
            continue
        meta = json.loads((d / "case.json").read_text())
        if tag and tag not in meta.get("tags", []):
            continue
        meta.update(name=d.name, dir=d, hash=tree_hash(d), task=(d / "task.md").read_text().strip())
        cases.append(meta)
    if not cases:
        sys.exit("no cases match")
    return cases


def make_workspace(case, root: Path):
    work, orig, meta = root / "work", root / "orig", root / "meta"
    for p in (work, orig, meta):
        p.mkdir(parents=True)
    shutil.copytree(case["dir"] / "repo", work, dirs_exist_ok=True)
    sh(["git", "-C", str(work), "init", "-q", "-b", "main"])
    # caches a test run leaves behind are not the agent's changes
    (work / ".git/info/exclude").write_text("__pycache__/\n*.pyc\n.pytest_cache/\nnode_modules/\n.DS_Store\n")
    sh(["git", "-C", str(work), "add", "-A"])
    sh(["git", "-C", str(work), "-c", "user.name=fixture", "-c", "user.email=fixture@example.com",
        "commit", "-q", "-m", "fixture"])
    shutil.copytree(work, orig, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
    return work, orig, meta


def measure_changes(work: Path, meta: Path):
    """Diff the agent's result against the fixture commit, excluding .git."""
    root = sh(["git", "-C", str(work), "rev-list", "--max-parents=0", "HEAD"]).stdout.split()[-1]
    sh(["git", "-C", str(work), "add", "-A"], check=False)
    names = sh(["git", "-C", str(work), "diff", "--cached", "--name-status", "--no-renames", root]).stdout
    nums = sh(["git", "-C", str(work), "diff", "--cached", "--numstat", "--no-renames", root]).stdout
    (meta / "changed.txt").write_text(names)
    (meta / "diff.patch").write_text(sh(["git", "-C", str(work), "diff", "--cached", "--no-renames", root]).stdout)
    added = removed = 0
    for line in nums.splitlines():
        a, r, _ = line.split("\t", 2)
        if a != "-":
            added, removed = added + int(a), removed + int(r)
    return {"files_changed": len(names.splitlines()), "lines_added": added, "lines_removed": removed}


def docker(args, timeout=None, env=None):
    return subprocess.run(["docker", "run", "--rm", *args], capture_output=True, text=True, timeout=timeout,
                          env=env)


def run_checks(case, work, orig, meta):
    mounts = ["-v", f"{work}:/work:ro", "-v", f"{orig}:/orig:ro", "-v", f"{meta}:/meta:ro",
              "-v", f"{EVALS / 'harness/lib.sh'}:/harness/lib.sh:ro", "-v", f"{case['dir'] / 'check.sh'}:/case/check.sh:ro"]
    if (case["dir"] / "hidden").exists():
        mounts += ["-v", f"{case['dir'] / 'hidden'}:/hidden:ro"]
    p = docker(["--network", "none", *mounts, IMAGE, "bash", "/case/check.sh"], timeout=600)
    checks = [json.loads(l) for l in p.stdout.splitlines() if l.startswith("{")]
    if not checks:
        checks = [{"name": "check.sh produced no results", "weight": 1, "required": True, "pass": False,
                   "detail": (p.stdout + p.stderr)[-1500:]}]
    return checks


def score(checks, agent_ok=True):
    total = sum(c["weight"] for c in checks) or 1
    return {"score": round(sum(c["weight"] for c in checks if c["pass"]) / total, 4),
            "pass": agent_ok and all(c["pass"] for c in checks if c["required"])}


# ---------- agent and judge ----------

def judge_env():
    args, env = AGENTS["claude"].auth(None)
    return args, {**{k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}, **env}


def run_agent(agent, arm, case, model, effort, extra, work, art, tmp: Path):
    """One agent session in a fresh container. Returns (record, final message)."""
    home, out = tmp / "home", tmp / "out"
    home.mkdir()
    out.mkdir()
    name = f"dzevals-{uuid.uuid4().hex[:10]}"
    auth_args, auth_env = agent.auth(home)
    mount_args, cli_args = agent.mounts(arm["dir"])
    prompt = prefix_for(arm, agent.name) + case["task"]
    cmd = agent.command(prompt, model, case, effort, extra) + cli_args
    args = ["--name", name, "--add-host", "host.docker.internal:host-gateway", "-w", "/work", "-v", f"{work}:/work", "-v", f"{out}:/out", *auth_args, *mount_args]
    env = {**{k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")},
           **auth_env}
    t0 = time.time()
    try:
        p = docker([*args, IMAGE, *cmd], timeout=case.get("timeout_s", 900), env=env)
        stdout, stderr, timed_out = p.stdout, p.stderr, False
    except subprocess.TimeoutExpired as e:
        subprocess.run(["docker", "kill", name], capture_output=True)
        stdout = e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
        stderr, timed_out = "", True
    agent.save_back(home)
    recovered = agent.collect(home, work, case["task"])
    (art / "transcript.jsonl").write_text(stdout)
    if stderr.strip():
        (art / "stderr.txt").write_text(stderr[-20000:])
    rec, final = agent.parse(stdout, out)
    rec["infra_error"] = agent.infra_error(stdout, stderr)
    rec["recovered_files"] = recovered  # moved in from outside the workspace by the adapter (agents.py)
    rec["wall_s"] = round(time.time() - t0, 1)
    rec["timed_out"] = timed_out
    if rec.get("duration_s") is None:
        rec["duration_s"] = rec["wall_s"]
    rec["finished"] = rec["finished"] and not timed_out
    return rec, final


JUDGE = """You grade one run of a coding agent against a rubric. Judge only what the evidence shows.
Reply with JSON only: a list with one object per criterion, {{"id": <n>, "pass": true|false, "why": "<one sentence>"}}.

## The task the agent was given
{task}

## Rubric
{rubric}

## The agent's final message
{final}

## Files the agent wrote that the rubric asks about
{files}

## The agent's diff (truncated)
{diff}
"""


def run_judge(case, judge_model, final, work, meta):
    lines = [l[2:].strip() for l in (case["dir"] / "rubric.md").read_text().splitlines() if l.startswith("- ")]
    rubric = "\n".join(f"{i}. {t}" for i, t in enumerate(lines, 1))
    files = ""
    for rel in case.get("judge_files", []):
        f = work / rel
        files += f"### {rel}\n" + (f.read_text()[:20000] if f.exists() else "(missing)") + "\n"
    prompt = JUDGE.format(task=case["task"], rubric=rubric, final=final[:20000] or "(none)",
                          files=files or "(none)", diff=(meta / "diff.patch").read_text()[:30000] or "(no changes)")
    args, env = judge_env()
    p = docker([*args, IMAGE, "claude", "-p", prompt, "--model", judge_model, "--tools", "", "--output-format", "json",
                "--no-session-persistence"], timeout=300, env=env)
    try:
        res = json.loads(p.stdout)
        verdicts = json.loads(re.search(r"\[.*\]", res["result"], re.S).group(0))
        cost = res.get("total_cost_usd") or 0
    except (ValueError, AttributeError, KeyError, TypeError):
        res = {}
    if AGENTS["claude"].infra_error(p.stdout, p.stderr) or not isinstance(res, dict) or "result" not in res:
        return [{"name": "judge answered", "weight": 1, "required": True, "pass": False, "infra": True,
                 "detail": (p.stdout + p.stderr)[-1500:]}], 0
    try:
        verdicts = json.loads(re.search(r"\[.*\]", res["result"], re.S).group(0))
        cost = res.get("total_cost_usd") or 0
    except (ValueError, AttributeError, KeyError, TypeError):
        return [{"name": "judge answered", "weight": 1, "required": True, "pass": False,
                 "detail": (p.stdout + p.stderr)[-1500:]}], 0
    by_id = {v.get("id"): v for v in verdicts}
    return [{"name": f"judge: {t}", "weight": 1, "required": False, "pass": bool(by_id.get(i, {}).get("pass")),
             "detail": by_id.get(i, {}).get("why", "no verdict")} for i, t in enumerate(lines, 1)], cost


# ---------- commands ----------

def cmd_build(_):
    subprocess.run(["docker", "build", "-t", IMAGE, str(EVALS / "harness")], check=True)


def cmd_selftest(a):
    bad = 0
    for case in load_cases(a.case, a.tag):
        with tempfile.TemporaryDirectory() as t:
            work, orig, meta = make_workspace(case, Path(t))
            measure_changes(work, meta)
            before = score(run_checks(case, work, orig, meta))
            patch = case["dir"] / "solution.patch"
            p = sh(["git", "-C", str(work), "apply", str(patch)], check=False)
            measure_changes(work, meta)
            after_checks = run_checks(case, work, orig, meta)
            after = score(after_checks)
        ok = not before["pass"] and after["pass"] and p.returncode == 0
        bad += not ok
        print(f"{'ok ' if ok else 'BAD'} {case['name']}: fixture pass={before['pass']} score={before['score']}; "
              f"solution applies={p.returncode == 0} pass={after['pass']} score={after['score']}")
        if not ok:
            for c in after_checks:
                if not c["pass"]:
                    print(f"      failing with the solution: {c['name']}: {c['detail'][-400:]}")
    sys.exit(1 if bad else 0)


def cache_key(agent, arm, case, model, effort, extra, i, judge="sonnet"):
    prefix = prefix_for(arm, agent.name)
    if agent.name == "claude" and not effort and not extra:  # the original key, so earlier Claude results stay valid
        parts = [arm["key"], prefix, case["hash"], model, CC_VERSION, i]
    else:
        parts = [agent.name, agent.version, agent.revision, arm["key"], prefix, case["hash"], model, effort, list(extra), i]
    if judge == "none" and (case["dir"] / "rubric.md").exists():
        parts.append("no-judge")  # appended only here, so every judged key stays as it was
    return hashlib.sha256(json.dumps(parts).encode()).hexdigest()[:20]


def cmd_agents(_):
    for a in AGENTS.values():
        print(f"{a.name:9} {a.version:10} {'ready' if a.available() else 'no credentials'}"
              f"{'  (one run at a time: OAuth sign-in)' if a.max_jobs() == 1 else ''}")


def cmd_run(a):
    agent = AGENTS[a.agent]
    model = a.model or agent.default_model  # None: the CLI's own default, recorded as "cli-default"
    extra = a.agent_arg or []
    if not agent.available():
        sys.exit(f"{agent.name}: no credentials (run.py agents; evals/README.md, 'Sign in')")
    if sys.platform == "linux" and os.getuid() != 1000:
        sys.exit(f"run as user id 1000, the containers' user (yours is {os.getuid()}); evals/README.md, 'Use it'")
    jobs_n = min(a.jobs, agent.max_jobs() or a.jobs)
    arms = load_arms([n for n in a.arms.split(",") if n] if a.arms else [], a.arm or [])
    cases = load_cases(a.case, a.tag, a.skip or ())
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run_dir = EVALS / "results" / run_id
    run_dir.mkdir(parents=True)
    cache = STATE / "results.jsonl"
    done = {}
    if cache.exists():
        for l in cache.read_text().splitlines():
            r = json.loads(l)
            done[r["key"]] = r
    jobs = [(arm, case, i) for i in range(a.runs) for case in cases for arm in arms]
    random.Random(run_id).shuffle(jobs)  # spread arms over time, so rate limits and drift hit them alike
    spent = [0.0]
    quota_hit = threading.Event()
    errors = []
    (run_dir / "run.json").write_text(json.dumps({"agent": agent.name, "agent_version": agent.version, "model": model or "cli-default",
        "effort": a.effort, "agent_args": extra, "runs": a.runs,
        "arms": [{k: v for k, v in x.items() if k != "dir"} for x in arms], "cases": [c["name"] for c in cases]}, indent=1))

    def one(job):
        arm, case, i = job
        key = cache_key(agent, arm, case, model, a.effort, extra, i, a.judge_model)
        if key in done and not a.force:
            rec = dict(done[key], cached=True)
        else:
            if (a.max_usd and spent[0] >= a.max_usd) or quota_hit.is_set():
                return None
            art = run_dir / "runs" / f"{arm['id']}__{case['name']}__{i}"
            for attempt in range(3):  # a provider's capacity error is retried; the agent's own failure is not
                shutil.rmtree(art, ignore_errors=True)
                art.mkdir(parents=True)
                with tempfile.TemporaryDirectory(dir=STATE) as t:
                    work, orig, meta = make_workspace(case, Path(t))
                    res, final = run_agent(agent, arm, case, model, a.effort, extra, work, art, Path(t))
                    if res["infra_error"]:
                        checks, judge_cost = [], 0
                    else:
                        changes = measure_changes(work, meta)
                        checks = run_checks(case, work, orig, meta)
                        judge_cost = 0
                        if (case["dir"] / "rubric.md").exists() and a.judge_model != "none":
                            jc, judge_cost = run_judge(case, a.judge_model, final, work, meta)
                            checks += jc
                            if any(c.get("infra") for c in jc):
                                res["infra_error"] = "quota"  # the grader hit its limit
                        shutil.copy(meta / "diff.patch", art / "diff.patch")
                if res["infra_error"] != "transient" or attempt == 2:
                    break
                time.sleep(60 * (attempt + 1))
            if res["infra_error"]:
                if res["infra_error"] == "quota":
                    quota_hit.set()
                with lock:
                    errors.append((arm["id"], case["name"], i, res["infra_error"]))
                    print(f"{arm['id']:>10} {case['name']:<34} run {i}: provider error ({res['infra_error']}), "
                          f"not scored{'; stopping the pass' if res['infra_error'] == 'quota' else ''}", flush=True)
                return None
            (art / "final.md").write_text(final)
            (art / "checks.json").write_text(json.dumps(checks, indent=1))
            rec = {"key": key, "arm": arm["id"], "arm_key": arm["key"], "prefix": prefix_for(arm, agent.name),
                   "case": case["name"], "case_hash": case["hash"], "agent": agent.name,
                   "agent_version": agent.version, "model": model or "cli-default", "effort": a.effort, "run": i,
                   "claude_code": CC_VERSION, "judge": a.judge_model, "judge_cost_usd": judge_cost, **res, **changes,
                   **score(checks, res["finished"]), "checks": [{k: c[k] for k in ("name", "pass", "required")} for c in checks]}
            with lock:
                spent[0] += (rec.get("cost_usd") or 0) + judge_cost
                with cache.open("a") as f:
                    f.write(json.dumps(rec) + "\n")
        with lock:
            with (run_dir / "results.jsonl").open("a") as f:
                f.write(json.dumps(rec) + "\n")
            tag = "cached" if rec.get("cached") else f"${(rec.get('cost_usd') or 0):.2f}"
            print(f"{rec['arm']:>10} {rec['case']:<34} run {i}: {'PASS' if rec['pass'] else 'fail'} "
                  f"score {rec['score']:.2f} {tag}", flush=True)
        return rec

    with cf.ThreadPoolExecutor(jobs_n) as ex:
        list(ex.map(one, jobs))
    if errors:
        print(f"\n{len(errors)} run(s) ended by the provider, not scored and not cached; run again to fill them in"
              + (" (a quota error stopped the pass)" if quota_hit.is_set() else ""))
    print(f"\nresults: {run_dir}")
    report([run_dir])


def load_results(dirs):
    recs = []
    for d in dirs:
        f = Path(d) / "results.jsonl"
        recs += [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []
    return recs


def report(dirs):
    recs = load_results(dirs)
    if not recs:
        print("no results")
        return
    combos = {(r.get("agent", "claude"), r["model"]) for r in recs}
    if len(combos) > 1:  # several agents or models: name each arm with them
        for r in recs:
            r["arm"] = f"{r['arm']} [{r.get('agent', 'claude')} {r['model']}]"
    arms = list(dict.fromkeys(r["arm"] for r in recs))
    order = []  # the run's own arm order, so the first arm (the baseline) is the one listed first
    for d in dirs:
        f = Path(d) / "run.json"
        order += [x["id"] for x in json.loads(f.read_text())["arms"]] if f.exists() else []
    arms = [a for a in dict.fromkeys(order) if a in arms] + [a for a in arms if a not in order]
    cases = sorted({r["case"] for r in recs})
    mean = lambda xs: statistics.fmean(xs) if xs else float("nan")
    print(f"\n| arm | runs | pass rate | mean score | mean cost $ | mean turns | mean min | output tok | lines +/- |")
    print("|---|---|---|---|---|---|---|---|---|")
    for arm in arms:
        rs = [r for r in recs if r["arm"] == arm]
        print(f"| {arm} | {len(rs)} | {mean([r['pass'] for r in rs]):.0%} | {mean([r['score'] for r in rs]):.2f} | "
              f"{mean([r.get('cost_usd') or 0 for r in rs]):.3f} | {mean([r.get('turns') or 0 for r in rs]):.1f} | "
              f"{mean([(r.get('duration_s') or 0) / 60 for r in rs]):.1f} | {mean([r.get('output_tokens') or 0 for r in rs]):.0f} | "
              f"{mean([r.get('lines_added', 0) for r in rs]):.0f}/{mean([r.get('lines_removed', 0) for r in rs]):.0f} |")
    print("\nPer case: passes/runs and mean score.\n")
    print("| case | " + " | ".join(arms) + " |")
    print("|---|" + "---|" * len(arms))
    for c in cases:
        cells = []
        for arm in arms:
            rs = [r for r in recs if r["arm"] == arm and r["case"] == c]
            cells.append(f"{sum(r['pass'] for r in rs)}/{len(rs)} ({mean([r['score'] for r in rs]):.2f})" if rs else "-")
        print(f"| {c} | " + " | ".join(cells) + " |")
    base = arms[0]
    for arm in arms[1:]:
        diffs = []
        for c in cases:
            x = [r["score"] for r in recs if r["arm"] == arm and r["case"] == c]
            y = [r["score"] for r in recs if r["arm"] == base and r["case"] == c]
            if x and y:
                diffs.append(mean(x) - mean(y))
        if not diffs:
            continue
        rng = random.Random(0)
        boots = sorted(mean([rng.choice(diffs) for _ in diffs]) for _ in range(2000))
        print(f"\n{arm} vs {base}: mean score difference {mean(diffs):+.3f} over {len(diffs)} cases "
              f"(95% bootstrap interval {boots[50]:+.3f} to {boots[1949]:+.3f}); "
              f"better on {sum(d > 0 for d in diffs)}, worse on {sum(d < 0 for d in diffs)}, tied on {sum(d == 0 for d in diffs)}")
    loaded = {arm: sorted({p for r in recs if r["arm"] == arm for p in (r.get("plugins") or [])}) for arm in arms}
    skills = {arm: sorted({s for r in recs if r["arm"] == arm for s in r.get("skills", []) if s}) for arm in arms}
    print("\nPlugins loaded: " + "; ".join(f"{a}: {', '.join(v) or 'none'}" for a, v in loaded.items()))
    print("Skills invoked: " + "; ".join(f"{a}: {', '.join(v) or 'none'}" for a, v in skills.items()))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build")
    sub.add_parser("agents")
    for name in ("selftest", "run"):
        p = sub.add_parser(name)
        p.add_argument("--case", default="*")
        p.add_argument("--tag")
        p.add_argument("--skip", action="append", help="leave out cases matching this glob (repeatable)")
    r = sub.choices["run"]
    r.add_argument("--arms", help="comma-separated ids from arms.json (default: all; none: only the --arm ones)")
    r.add_argument("--arm", action="append", help="extra arm: id=SOURCE|PROMPT_PREFIX, e.g. 'dz-new=git:HEAD|/daz-mode '")
    r.add_argument("--agent", default="claude", choices=sorted(AGENTS))
    r.add_argument("--model", help="the agent's model name (default: sonnet for claude; the CLI's own default otherwise)")
    r.add_argument("--effort", help="reasoning effort, passed to the agent's own flag")
    r.add_argument("--agent-arg", action="append", help="an extra argument for the agent CLI (repeatable)")
    r.add_argument("--judge-model", default="sonnet", help="Claude model for rubric cases; none: script checks only, no Claude needed")
    r.add_argument("--runs", type=int, default=2)
    r.add_argument("-j", "--jobs", type=int, default=3)
    r.add_argument("--max-usd", type=float, help="stop starting runs once the list-price cost reaches this")
    r.add_argument("--force", action="store_true", help="ignore cached results")
    p = sub.add_parser("report")
    p.add_argument("dirs", nargs="*")
    a = ap.parse_args()
    if a.cmd == "build":
        cmd_build(a)
    elif a.cmd == "agents":
        cmd_agents(a)
    elif a.cmd == "selftest":
        cmd_selftest(a)
    elif a.cmd == "run":
        cmd_run(a)
    else:
        report(a.dirs or sorted((EVALS / "results").iterdir())[-1:])


if __name__ == "__main__":
    main()
