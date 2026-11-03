"""Settings, layered: built-in defaults < config file < environment < command line. See docs/config.md."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Mapping

from reportly.errors import ConfigError
from reportly.reports import Report, build_reports

DEFAULT_FORMAT = "text"
CONFIG_NAME = "reportly.toml"
_TOP_LEVEL = {"format", "output", "plugins", "formats", "reports"}


@dataclass(frozen=True)
class Settings:
    format: str = DEFAULT_FORMAT
    output: str | None = None
    plugin_modules: tuple[str, ...] = ()
    format_options: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    reports: Mapping[str, Report] = field(default_factory=dict)
    base_dir: Path = Path(".")

    def options_for(self, format_name: str) -> dict[str, Any]:
        return dict(self.format_options.get(format_name, {}))


def find_config(explicit: str | None, env: Mapping[str, str], cwd: Path) -> Path | None:
    if explicit:
        path = Path(explicit)
        if not path.is_file():
            raise ConfigError(f"config file not found: {explicit}")
        return path
    if env.get("REPORTLY_CONFIG"):
        path = Path(env["REPORTLY_CONFIG"])
        if not path.is_file():
            raise ConfigError(f"REPORTLY_CONFIG points to a missing file: {path}")
        return path
    candidate = cwd / CONFIG_NAME
    return candidate if candidate.is_file() else None


def _string(raw: Mapping[str, Any], key: str, where: str) -> str | None:
    value = raw.get(key)
    if value is not None and not isinstance(value, str):
        raise ConfigError(f"{where}: `{key}` must be text")
    return value


def read_file(path: Path) -> Settings:
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"{path.name}: {exc}") from exc
    except OSError as exc:
        raise ConfigError(f"cannot read {path}: {exc.strerror}") from exc
    unknown = sorted(set(raw) - _TOP_LEVEL)
    if unknown:
        raise ConfigError(f"{path.name}: unknown setting {unknown[0]!r}")

    plugins = raw.get("plugins", {})
    modules = plugins.get("modules", []) if isinstance(plugins, dict) else None
    if not isinstance(modules, list) or not all(isinstance(m, str) for m in modules):
        raise ConfigError(f"{path.name}: [plugins] modules must be a list of module names")
    formats = raw.get("formats", {})
    if not isinstance(formats, dict) or not all(isinstance(v, dict) for v in formats.values()):
        raise ConfigError(f"{path.name}: [formats.<name>] must be tables")

    base = path.resolve().parent
    return Settings(
        format=_string(raw, "format", path.name) or DEFAULT_FORMAT,
        output=_string(raw, "output", path.name),
        plugin_modules=tuple(modules),
        format_options={name: dict(table) for name, table in formats.items()},
        reports=build_reports(raw.get("reports", {}), base),
        base_dir=base,
    )


def load_settings(
    config_path: Path | None,
    env: Mapping[str, str],
    *,
    format: str | None = None,
    output: str | None = None,
) -> Settings:
    """Defaults, then the file, then REPORTLY_FORMAT / REPORTLY_OUTPUT, then the explicit arguments."""
    settings = read_file(config_path) if config_path else Settings()
    if env.get("REPORTLY_FORMAT"):
        settings = replace(settings, format=env["REPORTLY_FORMAT"])
    if env.get("REPORTLY_OUTPUT"):
        settings = replace(settings, output=env["REPORTLY_OUTPUT"])
    if format:
        settings = replace(settings, format=format)
    if output:
        settings = replace(settings, output=output)
    return settings
