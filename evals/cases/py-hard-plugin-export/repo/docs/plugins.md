# Writing an output format

A format turns a report (its columns and its rows) into text on a stream. Formats are plugins: reportly knows nothing about them beyond what is written here.

## Registering a format

Put a module in `reportly/formats/` and decorate a class with `@register_format`:

```python
from reportly.plugins import FormatBase, Option, register_format


@register_format
class HtmlFormat(FormatBase):
    name = "html"
    extension = ".html"
    content_type = "text/html; charset=utf-8"
    description = "HTML table"
    streaming = True
    options = {"caption": Option(str, "")}

    def render(self, columns, rows, out):
        ...
```

- The registry imports every module of the `reportly.formats` package the first time anyone asks for a format, so a new module there needs no other change.
- There is no list of format names anywhere else. `--format` on the command line, `reportly formats`, `format = ...` in the config file and the error message for an unknown format all ask the registry. Do not add special cases for a format to the CLI, the runner or the config loader.
- Formats from outside this repository live in any importable module and are listed in the config file under `[plugins] modules = [...]`; those modules are imported before a report runs.
- `name`, `extension` (with the dot), `content_type` and `description` are required. A missing one, a name that is not lowercase letters, digits, `_` or `-`, or a name that is already taken raises `PluginError` when the module is imported.

## Options

`options` maps option names to `Option(type, default, help, validate)`. Values come from the config file (`[formats.<name>]`) or from `--option NAME=VALUE`. The base class converts them to the option's type, rejects names the format does not declare, and puts the result in `self.opts`; both problems are a `ConfigError`. A `validate` function raises `ValueError` with a message for a value that is not allowed. Supported types: `str`, `int`, `bool`.

## Receiving rows

`render(self, columns, rows, out)` is called once per run.

- `columns` is a sequence of `Column(key, title, kind)`.
- `rows` is an iterable. Every row has one value per column, in column order. Values are `str`, `int`, `float`, `Decimal`, `bool`, `date`, `datetime` or `None`.
- `out` is a text stream. Write to it with `out.write`; never close it. The runner opens and closes files.
- A row with a different number of values than there are columns is an error: raise `RowError(row_number, expected, got)`. Row numbers start at 1 for the first data row (a header row does not count).

## Streaming

Reports can have millions of rows, so a format's memory use must not grow with the report. A format that handles its rows one at a time says so with `streaming = True`. Then:

- the runner passes `rows` as a one-shot iterator, produced lazily, which raises an error if it is iterated a second time;
- the format iterates it exactly once and writes as it goes. It may hold at most `BUFFER_ROWS` (100) rows at any time. Turning `rows` into a list, tuple or set, sorting it, or making a first pass over it to measure something is not allowed.

A format that has to see every row before it can write the first (the text format needs the column widths) says `streaming = False`, and the runner passes it a list. Do not declare a format non-streaming to make it easier to write: it makes the runner load the whole report into memory.

## Cell values

`reportly.formatting` has the two ways to turn a value into text. Use these; do not write your own.

- `display(value)` is for people (`text`, `markdown`): thousands separators, two decimals, `yes`/`no`, `-` for a missing value.
- `machine(value)` is for programs and spreadsheets: nothing for `None`, `true`/`false` for booleans, exact digits for numbers, ISO 8601 for dates and datetimes. A format whose output a program reads must use `machine`.

## Spreadsheet formats (CSV and similar)

Formats that write delimiter-separated values follow these conventions, so that every export opens the same way in Excel, LibreOffice, Google Sheets and pandas.

1. **Encoding.** The output is UTF-8 and starts with a byte order mark (`U+FEFF`) unless the option `bom` is false. `bom` defaults to true.
2. **Header.** The first row holds the column *titles* (not the keys) unless the option `header` is false. `header` defaults to true. An empty report is still a valid file: just the byte order mark (if enabled) and the header row (if enabled).
3. **Delimiter.** The option `delimiter`, default `,`. It must be exactly one character, and not a double quote, a carriage return or a line feed; otherwise the option is rejected.
4. **Line ends.** Every row ends with CRLF (`\r\n`), the last one too.
5. **Quoting.** A cell is wrapped in double quotes only when it contains the delimiter, a double quote, a carriage return or a line feed. A double quote inside a quoted cell is doubled. Line breaks inside a cell are kept as they are.
6. **Values** go through `machine()`.
7. **Formula guard.** A spreadsheet treats a cell that starts with `=`, `+`, `-` or `@`, or with a tab or a carriage return, as a formula. Every *text* cell that starts with one of these characters gets a single quote `'` in front of it, before quoting is applied: `=SUM(A1:A9)` is written as `'=SUM(A1:A9)` and `=a,b` as `"'=a,b"`. The guard applies to values that are `str`, and to the header titles. It does not apply to numbers: ints, floats and Decimals are never changed, so `-12.5` stays `-12.5`. Booleans, dates, datetimes and missing values are not touched either.

## Built-in formats

| name | extension | streams | notes |
|---|---|---|---|
| `text` | `.txt` | no | aligned table with a row count; option `max_width` |
| `markdown` | `.md` | yes | GitHub-flavoured table; option `escape` |
