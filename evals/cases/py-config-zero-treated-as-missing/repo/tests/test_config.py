import json

import pytest

from jobrunner.config import BUILTIN, ConfigError, load_config


def write(tmp_path, data):
    path = tmp_path / "jobs.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return str(path)


def one(tmp_path, job, defaults=None):
    data = {"jobs": {"j": {"command": "true", **job}}}
    if defaults is not None:
        data["defaults"] = defaults
    return load_config(write(tmp_path, data))[0]


def test_built_in_defaults(tmp_path):
    job = one(tmp_path, {})
    assert (job.retries, job.timeout, job.retry_delay, job.enabled) == (3, 300, 5, True)
    assert job.notify == ["oncall@example.com"]
    assert job.log_file == "logs/j.log"


def test_defaults_section_overrides_built_in(tmp_path):
    job = one(tmp_path, {}, {"retries": 1, "timeout": 60, "notify": ["ops@example.com"]})
    assert (job.retries, job.timeout, job.notify) == (1, 60, ["ops@example.com"])


def test_job_overrides_defaults(tmp_path):
    job = one(tmp_path, {"retries": 5, "retry_delay": 0.5, "log_file": "x.log"}, {"retries": 1, "retry_delay": 9})
    assert (job.retries, job.retry_delay, job.log_file) == (5, 0.5, "x.log")


def test_null_counts_as_not_set(tmp_path):
    job = one(tmp_path, {"retries": None}, {"retries": 2})
    assert job.retries == 2


def test_log_file_template(tmp_path):
    assert one(tmp_path, {"log_file": "out/{name}-run.txt"}).log_file == "out/j-run.txt"


def test_jobs_keep_file_order(tmp_path):
    data = {"jobs": {"b": {"command": "x"}, "a": {"command": "y"}}}
    assert [j.name for j in load_config(write(tmp_path, data))] == ["b", "a"]


@pytest.mark.parametrize("job", [
    {"retries": -1}, {"retries": 1.5}, {"retries": "2"}, {"timeout": -5}, {"timeout": "soon"},
    {"retry_delay": [1]}, {"enabled": "yes"}, {"notify": "ops@example.com"}, {"log_file": 7},
    {"colour": "red"},
])
def test_invalid_settings(tmp_path, job):
    with pytest.raises(ConfigError):
        one(tmp_path, job)


@pytest.mark.parametrize("job", [{}, {"command": ""}, {"command": 5}])
def test_command_is_required(tmp_path, job):
    with pytest.raises(ConfigError, match="command is required"):
        load_config(write(tmp_path, {"jobs": {"j": job}}))


def test_bad_files(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{", encoding="utf-8")
    with pytest.raises(ConfigError, match="invalid JSON"):
        load_config(str(bad))
    with pytest.raises(ConfigError):
        load_config(write(tmp_path, {"jobs": []}))
    with pytest.raises(ConfigError, match="defaults"):
        load_config(write(tmp_path, {"defaults": {"command": "x"}, "jobs": {}}))


def test_built_in_table_matches_the_readme():
    assert set(BUILTIN) == {"retries", "timeout", "retry_delay", "enabled", "notify", "log_file"}
