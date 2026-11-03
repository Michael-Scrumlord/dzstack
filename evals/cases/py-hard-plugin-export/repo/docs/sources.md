# Sources

A source yields the rows of a report lazily, as tuples with one converted value per column. Nothing in reportly needs all the rows at once except formats that declare `streaming = False`.

| source | settings | notes |
|---|---|---|
| `jsonl` | `path` | one JSON object per line; missing keys are `None`; blank lines are skipped |
| `sqlite` | `path`, `query` | opened read-only; the query's columns are matched to the report's columns by position |
| (library) `MemorySource` | columns, an iterable of rows | for tests and embedding; a generator streams |

Values are converted by the column's `kind` (`reportly.columns.convert`): `int`, `decimal` (via `Decimal(str(value))`), `date` and `datetime` (ISO 8601), `bool` (`true/false/yes/no/1/0` as text), `text`.
