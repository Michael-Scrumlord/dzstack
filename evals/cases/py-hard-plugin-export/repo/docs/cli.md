# Command line

```
reportly run REPORT [--config FILE] [--format NAME] [--output FILE] [--option NAME=VALUE ...] [--stats]
reportly formats [--config FILE]
reportly reports [--config FILE]
```

- `run` builds the report named in the config file and writes it in the chosen format, to `--output` or standard output. The format is `--format`, else `$REPORTLY_FORMAT`, else `format` in the config file, else `text`.
- `--option NAME=VALUE` sets a format option for this run, on top of `[formats.<name>]` from the config file. Values are converted to the option's type.
- `formats` lists every registered format with its extension and description, one per line.
- `--stats` prints the number of rows and the run time on standard error.

Exit status: 0 on success, 1 when the data could not be read or a row is malformed, 2 for usage, config and plugin errors. Errors are one line on standard error, starting with `reportly: error:`, and nothing is written to standard output before a usage or config error is found.

Files are written as UTF-8 with no newline translation, so the line ends a format writes are the line ends in the file.
