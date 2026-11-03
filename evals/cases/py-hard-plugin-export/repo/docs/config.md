# Configuration

reportly reads one TOML file. It is found, in this order, from `--config FILE`, from `$REPORTLY_CONFIG`, or as `reportly.toml` in the current folder. Without a file, only the built-in defaults apply (and no reports are defined).

Settings are layered; later layers win:

1. built-in defaults (`format = "text"`, output to standard output);
2. the config file;
3. the environment: `REPORTLY_FORMAT`, `REPORTLY_OUTPUT`;
4. the command line: `--format`, `--output`, `--option`.

## File layout

```toml
format = "markdown"          # default output format, by registry name
output = "out/report.md"     # default output file (relative to the current folder); omit for standard output

[plugins]
modules = ["acme.reportly_extras"]    # extra modules that register formats

[formats.markdown]            # options of one format (see docs/plugins.md)
escape = false

[reports.sales]
source = "jsonl"
path = "data/sales.jsonl"     # relative to the config file
limit = 1000                  # optional
columns = [
  { key = "region", title = "Region" },
  { key = "amount", title = "Amount", kind = "decimal" },
]
```

- `format` can be the name of any registered format. The config loader does not know the names; the registry is asked when the report runs, and an unknown name is an error that lists the available ones.
- `[formats.<name>]` holds that format's options. An option the format does not declare, or a value of the wrong type, is an error that names the option.
- Unknown top-level settings are errors, so a typo does not go unnoticed.
- A report's `where` table keeps rows whose column equals the value: `where = { region = "EU" }`.
- Column `kind` is one of `text` (default), `int`, `decimal`, `date`, `datetime`, `bool`.
