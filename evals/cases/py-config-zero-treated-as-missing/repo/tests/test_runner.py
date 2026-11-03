import logging

from jobrunner.config import Job
from jobrunner.runner import run_all, run_job


def job(command, **kw):
    base = dict(name="j", command=command, retries=0, timeout=10, retry_delay=0, enabled=True,
                notify=[], log_file=None)
    base.update(kw)
    return Job(**base)


def counting(tmp_path, exit_code):
    """A command that adds a line to count.txt and exits with `exit_code`."""
    return f"echo x >> count.txt; exit {exit_code}"


def attempts_made(tmp_path):
    path = tmp_path / "count.txt"
    return len(path.read_text().split()) if path.exists() else 0


def test_success_runs_once(tmp_path):
    result = run_job(job(counting(tmp_path, 0), retries=3), base_dir=tmp_path)
    assert (result.status, result.attempts) == ("ok", 1)
    assert attempts_made(tmp_path) == 1


def test_failure_is_retried_then_reported(tmp_path):
    sleeps = []
    result = run_job(job(counting(tmp_path, 1), retries=2, retry_delay=7), base_dir=tmp_path, sleep=sleeps.append)
    assert (result.status, result.attempts) == ("failed", 3)
    assert attempts_made(tmp_path) == 3
    assert sleeps == [7, 7]


def test_recovers_on_a_later_attempt(tmp_path):
    cmd = "echo x >> count.txt; [ $(wc -l < count.txt) -ge 2 ]"
    result = run_job(job(cmd, retries=3), base_dir=tmp_path)
    assert (result.status, result.attempts) == ("ok", 2)


def test_timeout(tmp_path):
    result = run_job(job("exec sleep 5", timeout=0.2), base_dir=tmp_path)
    assert result.status == "timeout"


def test_no_time_limit_when_timeout_is_zero(tmp_path):
    result = run_job(job("sleep 0.3", timeout=0), base_dir=tmp_path)
    assert result.status == "ok"


def test_notify_after_giving_up(tmp_path):
    told = []
    run_job(job("exit 1", notify=["a@example.com"]), base_dir=tmp_path, notify=lambda to, msg: told.append((to, msg)))
    assert told == [(["a@example.com"], "job j failed after 1 attempt")]


def test_no_notification_on_success_or_for_an_empty_list(tmp_path):
    told = []
    run_job(job("exit 0", notify=["a@example.com"]), base_dir=tmp_path, notify=lambda *a: told.append(a))
    run_job(job("exit 1", notify=[]), base_dir=tmp_path, notify=lambda *a: told.append(a))
    assert told == []


def test_log_file_collects_output(tmp_path):
    run_job(job("echo hello", log_file="logs/j.log"), base_dir=tmp_path)
    assert "hello" in (tmp_path / "logs" / "j.log").read_text()


def test_disabled_jobs_are_skipped(tmp_path):
    results = run_all([job(counting(tmp_path, 0), enabled=False), job(counting(tmp_path, 0), name="k")], base_dir=tmp_path)
    assert [(r.name, r.status) for r in results] == [("j", "skipped"), ("k", "ok")]
    assert attempts_made(tmp_path) == 1


def test_start_line_shows_the_settings(tmp_path, caplog):
    with caplog.at_level(logging.INFO, logger="jobrunner"):
        run_job(job("true", retries=3, timeout=300), base_dir=tmp_path)
        run_job(job("true", retries=0, timeout=0), base_dir=tmp_path)
    assert "j: starting (retries=3, timeout=300s)" in caplog.text
    assert "j: starting (retries=0, timeout=none)" in caplog.text
