from pathlib import Path

import pytest

from reportly.config import Settings, find_config, load_settings, read_file
from reportly.errors import ConfigError


def test_defaults_without_a_file():
    settings = load_settings(None, {})
    assert settings == Settings()
    assert settings.format == "text" and settings.output is None


def test_the_file_overrides_the_defaults(write_config):
    path = write_config('format = "markdown"\noutput = "out.md"\n[formats.markdown]\nescape = false\n')
    settings = load_settings(path, {})
    assert settings.format == "markdown"
    assert settings.output == "out.md"
    assert settings.options_for("markdown") == {"escape": False}
    assert settings.options_for("text") == {}
    assert list(settings.reports) == ["sales"]


def test_environment_beats_the_file_and_arguments_beat_the_environment(write_config):
    path = write_config('format = "markdown"\n')
    assert load_settings(path, {"REPORTLY_FORMAT": "text"}).format == "text"
    assert load_settings(path, {"REPORTLY_FORMAT": "text"}, format="markdown").format == "markdown"
    assert load_settings(path, {"REPORTLY_OUTPUT": "env.txt"}).output == "env.txt"
    assert load_settings(path, {"REPORTLY_OUTPUT": "env.txt"}, output="arg.txt").output == "arg.txt"


def test_the_config_does_not_check_format_names(write_config):
    # the registry is asked when the report runs
    assert load_settings(write_config('format = "no-such-format"\n'), {}).format == "no-such-format"


def test_plugin_modules(write_config):
    assert read_file(write_config('[plugins]\nmodules = ["acme.extras"]\n')).plugin_modules == ("acme.extras",)
    with pytest.raises(ConfigError, match="modules must be a list"):
        read_file(write_config('[plugins]\nmodules = "acme.extras"\n'))


@pytest.mark.parametrize(
    "head, message",
    [
        ("formt = 'text'\n", "unknown setting 'formt'"),
        ("format = 3\n", "`format` must be text"),
        ("[formats]\ncsv = 3\n", r"\[formats.<name>\] must be tables"),
    ],
)
def test_mistakes_are_errors(write_config, head, message):
    with pytest.raises(ConfigError, match=message):
        read_file(write_config(head))


def test_broken_toml_names_the_file(tmp_path):
    bad = tmp_path / "bad.toml"
    bad.write_text("format = ", encoding="utf-8")
    with pytest.raises(ConfigError, match="bad.toml"):
        read_file(bad)


def test_finding_the_config(tmp_path, write_config):
    path = write_config()
    assert find_config(None, {}, tmp_path) == path
    assert find_config(None, {}, tmp_path / "elsewhere") is None
    assert find_config(str(path), {}, tmp_path / "elsewhere") == path
    assert find_config(None, {"REPORTLY_CONFIG": str(path)}, tmp_path / "elsewhere") == path
    with pytest.raises(ConfigError, match="not found"):
        find_config("missing.toml", {}, tmp_path)
    with pytest.raises(ConfigError, match="REPORTLY_CONFIG"):
        find_config(None, {"REPORTLY_CONFIG": "missing.toml"}, tmp_path)


def test_report_columns_are_checked(write_config, tmp_path):
    path = tmp_path / "bad.toml"
    path.write_text('[reports.r]\nsource = "jsonl"\npath = "x"\ncolumns = [{ key = "a", kind = "money" }]\n', encoding="utf-8")
    with pytest.raises(ConfigError, match=r"reports.r.columns\[1\]: kind must be one of"):
        read_file(path)
    path.write_text('[reports.r]\nsource = "ftp"\ncolumns = [{ key = "a" }]\n', encoding="utf-8")
    with pytest.raises(ConfigError, match="unknown source 'ftp'"):
        read_file(path)
