import json

from jobrunner.cli import main


def test_runs_jobs_and_reports_the_exit_status(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    cfg = tmp_path / "jobs.json"
    cfg.write_text(json.dumps({"jobs": {
        "good": {"command": "true", "log_file": "good.log"},
    }}))
    assert main([str(cfg)]) == 0
    cfg.write_text(json.dumps({"jobs": {"bad": {"command": "false", "retries": 1, "retry_delay": 0.01}}}))
    assert main([str(cfg)]) == 1


def test_bad_config_and_unknown_job(tmp_path, capsys):
    cfg = tmp_path / "jobs.json"
    cfg.write_text("[]")
    assert main([str(cfg)]) == 2
    assert "jobrunner:" in capsys.readouterr().err
    cfg.write_text(json.dumps({"jobs": {"a": {"command": "true"}}}))
    assert main([str(cfg), "--only", "zzz"]) == 2
