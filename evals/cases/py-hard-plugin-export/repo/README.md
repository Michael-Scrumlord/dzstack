# reportly

Builds reports from data sources (JSON lines files, SQLite queries) and writes them in the output format you pick.

```
$ reportly formats
markdown  .md    GitHub-flavoured Markdown table
text      .txt   aligned plain-text table
$ reportly run sales --config reportly.toml --format markdown --output sales.md
```

Python 3.11, standard library only. Tests: `python3 -m pytest`.

## Layout

| Path | What it holds |
|---|---|
| `reportly/cli.py`, `__main__.py` | the command line (`run`, `formats`, `reports`) |
| `reportly/config.py` | layered settings: defaults, config file, environment, command line |
| `reportly/reports.py`, `columns.py`, `transform.py` | report definitions, columns and value conversion, lazy filters |
| `reportly/sources/` | `jsonl`, `sqlite` and an in-memory source |
| `reportly/plugins/` | the plugin API and the format registry |
| `reportly/formats/` | the built-in output formats, one module each |
| `reportly/formatting.py` | `display()` and `machine()`: how a value becomes text |
| `reportly/runner.py` | runs a report through a format, streaming or not |
| `docs/` | `plugins.md` (how formats register, receive rows, escape and stream), `config.md`, `cli.md`, `sources.md` |

Read `docs/plugins.md` before adding or changing an output format.
