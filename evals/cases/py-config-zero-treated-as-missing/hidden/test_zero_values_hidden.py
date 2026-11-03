"""Hidden checks: zero, false, empty, null and missing values for every setting that has a default."""
import itertools
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from jobrunner.config import ConfigError, load_config  # noqa: E402
from jobrunner.runner import run_all, run_job  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# For each setting: the value in the file that means "off/none/zero", what the Job holds then,
# two ordinary values (job level, defaults level) with what the Job holds, and the built-in default.
KEYS = {
    "retries": dict(zero=0, zero_out=0, job=5, job_out=5, dflt=2, dflt_out=2, builtin=3),
    "timeout": dict(zero=0, zero_out=0, job=45, job_out=45, dflt=90, dflt_out=90, builtin=300),
    "retry_delay": dict(zero=0, zero_out=0, job=2.5, job_out=2.5, dflt=30, dflt_out=30, builtin=5),
    "enabled": dict(zero=False, zero_out=False, job=True, job_out=True, dflt=True, dflt_out=True, builtin=True),
    "notify": dict(zero=[], zero_out=[], job=["j@example.com"], job_out=["j@example.com"],
                   dflt=["d1@example.com", "d2@example.com"], dflt_out=["d1@example.com", "d2@example.com"],
                   builtin=["oncall@example.com"]),
    "log_file": dict(zero="", zero_out=None, job="job/{name}.log", job_out="job/j.log",
                     dflt="dflt/{name}.log", dflt_out="dflt/j.log", builtin="logs/j.log"),
}
STATES = ["missing", "null", "zero", "other"]


def value_for(key, state, level):
    spec = KEYS[key]
    return {"zero": spec["zero"], "null": None, "other": spec[level]}[state]


def expected_for(key, job_state, dflt_state):
    spec = KEYS[key]
    if job_state in ("zero", "other"):
        return spec["zero_out"] if job_state == "zero" else spec["job_out"]
    if dflt_state in ("zero", "other"):
        return spec["zero_out"] if dflt_state == "zero" else spec["dflt_out"]
    return spec["builtin"]


def write(tmp_path, data):
    path = tmp_path / "jobs.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return str(path)


def load_one(tmp_path, job, defaults=None):
    data = {"jobs": {"j": {"command": "true", **job}}}
    if defaults is not None:
        data["defaults"] = defaults
    return load_config(write(tmp_path, data))[0]


@pytest.mark.parametrize("job_state, dflt_state", list(itertools.product(STATES, STATES)))
@pytest.mark.parametrize("key", sorted(KEYS))
def test_every_combination_of_job_and_defaults_values(tmp_path, key, job_state, dflt_state):
    job = {} if job_state == "missing" else {key: value_for(key, job_state, "job")}
    defaults = {} if dflt_state == "missing" else {key: value_for(key, dflt_state, "dflt")}
    got = getattr(load_one(tmp_path, job, defaults), key)
    assert got == expected_for(key, job_state, dflt_state)


@pytest.mark.parametrize("key", sorted(KEYS))
def test_without_a_defaults_section(tmp_path, key):
    spec = KEYS[key]
    assert getattr(load_one(tmp_path, {key: spec["zero"]}), key) == spec["zero_out"]
    assert getattr(load_one(tmp_path, {}), key) == spec["builtin"]
    assert getattr(load_one(tmp_path, {}, None), key) == spec["builtin"]


def test_a_null_defaults_section_is_the_same_as_none(tmp_path):
    data = {"defaults": None, "jobs": {"j": {"command": "true", "retries": 0}}}
    job = load_config(write(tmp_path, data))[0]
    assert (job.retries, job.timeout) == (0, 300)


def test_all_zero_values_together(tmp_path):
    job = load_one(tmp_path, {k: v["zero"] for k, v in KEYS.items()}, {"retries": 4, "timeout": 60, "notify": ["x@y.z"]})
    assert (job.retries, job.timeout, job.retry_delay, job.enabled, job.notify, job.log_file) == (
        0, 0, 0, False, [], None)


def test_each_job_gets_its_own_values(tmp_path):
    data = {
        "defaults": {"retries": 2, "timeout": 600},
        "jobs": {
            "nightly-export": {"command": "./export.sh", "retries": 0},
            "cleanup": {"command": "./cleanup.sh", "timeout": 0, "notify": []},
            "plain": {"command": "./plain.sh"},
        },
    }
    export, cleanup, plain = load_config(write(tmp_path, data))
    assert (export.retries, export.timeout) == (0, 600)
    assert (cleanup.retries, cleanup.timeout, cleanup.notify) == (2, 0, [])
    assert (plain.retries, plain.timeout, plain.notify) == (2, 600, ["oncall@example.com"])


@pytest.mark.parametrize("key, bad", [
    ("retries", False), ("retries", ""), ("retries", []),
    ("timeout", False), ("timeout", ""), ("timeout", {}),
    ("retry_delay", False), ("retry_delay", ""), ("retry_delay", []),
    ("enabled", 0), ("enabled", ""), ("enabled", []),
    ("notify", ""), ("notify", 0), ("notify", {}),
    ("log_file", 0), ("log_file", False), ("log_file", []),
])
def test_wrong_types_are_errors_even_when_they_look_empty(tmp_path, key, bad):
    with pytest.raises(ConfigError):
        load_one(tmp_path, {key: bad})
    with pytest.raises(ConfigError):
        load_one(tmp_path, {}, {key: bad})


@pytest.mark.parametrize("job", [{"retries": -1}, {"timeout": -0.5}, {"retry_delay": -3}])
def test_negative_numbers_are_still_errors(tmp_path, job):
    with pytest.raises(ConfigError):
        load_one(tmp_path, job)


def test_command_must_not_be_empty(tmp_path):
    with pytest.raises(ConfigError, match="command is required"):
        load_config(write(tmp_path, {"jobs": {"j": {"command": ""}}}))


# ---- through the runner ----

def counter_cmd(exit_code):
    return f"echo x >> count.txt; exit {exit_code}"


def lines(path):
    return len(path.read_text().split()) if path.exists() else 0


def test_retries_zero_runs_a_failing_job_once(tmp_path):
    cfg = {"defaults": {"retries": 3}, "jobs": {"j": {"command": counter_cmd(1), "retries": 0}}}
    [job] = load_config(write(tmp_path, cfg))
    sleeps, told = [], []
    result = run_job(job, base_dir=tmp_path, sleep=sleeps.append, notify=lambda to, msg: told.append(to))
    assert (result.status, result.attempts) == ("failed", 1)
    assert lines(tmp_path / "count.txt") == 1
    assert sleeps == []
    assert told == [["oncall@example.com"]]


def test_retry_delay_zero_retries_immediately(tmp_path):
    cfg = {"defaults": {"retry_delay": 30}, "jobs": {"j": {"command": counter_cmd(1), "retries": 2, "retry_delay": 0}}}
    [job] = load_config(write(tmp_path, cfg))
    sleeps = []
    run_job(job, base_dir=tmp_path, sleep=sleeps.append)
    assert sleeps == [0, 0]
    assert lines(tmp_path / "count.txt") == 3


def test_timeout_zero_means_no_limit(tmp_path):
    cfg = {"defaults": {"timeout": 0.2}, "jobs": {"j": {"command": "sleep 0.8", "timeout": 0, "retries": 0}}}
    [job] = load_config(write(tmp_path, cfg))
    assert run_job(job, base_dir=tmp_path).status == "ok"
    cfg["jobs"]["j"].pop("timeout")
    [limited] = load_config(write(tmp_path, cfg))
    assert run_job(limited, base_dir=tmp_path).status == "timeout"


def test_disabled_job_does_not_run(tmp_path):
    cfg = {"defaults": {"enabled": True}, "jobs": {
        "off": {"command": counter_cmd(0), "enabled": False},
        "on": {"command": counter_cmd(0)},
    }}
    results = run_all(load_config(write(tmp_path, cfg)), base_dir=tmp_path)
    assert [(r.name, r.status) for r in results] == [("off", "skipped"), ("on", "ok")]
    assert lines(tmp_path / "count.txt") == 1


def test_empty_notify_tells_nobody(tmp_path):
    cfg = {"jobs": {"j": {"command": "exit 1", "retries": 0, "notify": []}}}
    [job] = load_config(write(tmp_path, cfg))
    told = []
    run_job(job, base_dir=tmp_path, notify=lambda to, msg: told.append(to))
    assert told == []


def test_empty_log_file_writes_no_log(tmp_path):
    cfg = {"jobs": {"j": {"command": "echo hi", "log_file": ""}}}
    [job] = load_config(write(tmp_path, cfg))
    run_job(job, base_dir=tmp_path)
    assert list(tmp_path.glob("**/*.log")) == [] and sorted(p.name for p in tmp_path.iterdir()) == ["jobs.json"]


def test_default_log_file_is_still_written(tmp_path):
    [job] = load_config(write(tmp_path, {"jobs": {"j": {"command": "echo hi"}}}))
    run_job(job, base_dir=tmp_path)
    assert "hi" in (tmp_path / "logs" / "j.log").read_text()


def test_the_cli_logs_what_the_user_configured(tmp_path):
    cfg = {"jobs": {"nightly-export": {"command": counter_cmd(1), "retries": 0, "log_file": ""}}}
    path = write(tmp_path, cfg)
    env = {**os.environ, "PYTHONPATH": str(ROOT), "PYTHONDONTWRITEBYTECODE": "1"}
    proc = subprocess.run([sys.executable, "-m", "jobrunner", path], cwd=tmp_path, env=env,
                          capture_output=True, text=True, timeout=60)
    assert proc.returncode == 1
    assert "nightly-export: starting (retries=0, timeout=300s)" in proc.stderr
    assert "retrying" not in proc.stderr
    assert "giving up after 1 attempt\n" in proc.stderr
    assert lines(tmp_path / "count.txt") == 1
