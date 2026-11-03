"""Read jobs.json and work out each job's settings."""
from __future__ import annotations

import json
from dataclasses import dataclass

BUILTIN = {
    "retries": 3,
    "timeout": 300,
    "retry_delay": 5,
    "enabled": True,
    "notify": ["oncall@example.com"],
    "log_file": "logs/{name}.log",
}
KNOWN = {"command", *BUILTIN}


class ConfigError(ValueError):
    """jobs.json is unreadable or a setting is invalid."""


@dataclass(frozen=True)
class Job:
    name: str
    command: str
    retries: int
    timeout: float  # seconds per attempt; 0 means no limit
    retry_delay: float  # seconds between attempts
    enabled: bool
    notify: list[str]
    log_file: str | None  # None means no log file


def _first(raw: dict, defaults: dict, key: str):
    """The job's own value, else the one in `defaults`, else the built-in value."""
    value = raw.get(key)
    if not value:
        value = defaults.get(key)
    if not value:
        value = BUILTIN[key]
    return value


def _check_number(value, name: str, key: str, whole: bool = False) -> None:
    kind = "a whole number" if whole else "a number"
    if isinstance(value, bool) or not isinstance(value, int if whole else (int, float)):
        raise ConfigError(f"job {name!r}: {key} must be {kind}, got {value!r}")
    if value < 0:
        raise ConfigError(f"job {name!r}: {key} must not be negative, got {value!r}")


def resolve_job(name: str, raw: dict, defaults: dict) -> Job:
    if not isinstance(raw, dict):
        raise ConfigError(f"job {name!r}: must be an object")
    unknown = sorted(set(raw) - KNOWN)
    if unknown:
        raise ConfigError(f"job {name!r}: unknown setting(s): {', '.join(unknown)}")
    command = raw.get("command")
    if not isinstance(command, str) or not command.strip():
        raise ConfigError(f"job {name!r}: command is required")

    retries = raw.get("retries") or defaults.get("retries") or BUILTIN["retries"]
    timeout = raw.get("timeout") or defaults.get("timeout") or BUILTIN["timeout"]
    retry_delay = _first(raw, defaults, "retry_delay")
    enabled = _first(raw, defaults, "enabled")
    notify = _first(raw, defaults, "notify")
    log_file = _first(raw, defaults, "log_file")

    _check_number(retries, name, "retries", whole=True)
    _check_number(timeout, name, "timeout")
    _check_number(retry_delay, name, "retry_delay")
    if not isinstance(enabled, bool):
        raise ConfigError(f"job {name!r}: enabled must be true or false, got {enabled!r}")
    if not isinstance(notify, list) or not all(isinstance(a, str) and a.strip() for a in notify):
        raise ConfigError(f"job {name!r}: notify must be a list of addresses")
    if not isinstance(log_file, str):
        raise ConfigError(f"job {name!r}: log_file must be a string, got {log_file!r}")

    return Job(
        name=name,
        command=command,
        retries=retries,
        timeout=timeout,
        retry_delay=retry_delay,
        enabled=enabled,
        notify=list(notify),
        log_file=log_file.replace("{name}", name) if log_file else None,
    )


def load_config(path: str) -> list[Job]:
    """All jobs in the file, in file order (disabled ones included)."""
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path}: invalid JSON: {exc}") from None
    if not isinstance(data, dict) or not isinstance(data.get("jobs"), dict):
        raise ConfigError(f"{path}: expected an object with a \"jobs\" object")
    defaults = data.get("defaults") or {}
    if not isinstance(defaults, dict):
        raise ConfigError(f"{path}: \"defaults\" must be an object")
    stray = sorted(set(defaults) - set(BUILTIN))
    if stray:
        raise ConfigError(f"{path}: unknown setting(s) in defaults: {', '.join(stray)}")
    return [resolve_job(name, raw, defaults) for name, raw in data["jobs"].items()]
