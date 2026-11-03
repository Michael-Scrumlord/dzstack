Please add a `--format json` option to the expenses CLI so other scripts can read the summary. `--format text` stays the default, and the text output must not change at all.

What the JSON output should look like:

- One JSON document on stdout (pretty-printed or compact, your choice) and nothing else on stdout.
- The top-level object has the keys `categories`, `count` and `total`, in that order.
- `categories` is an array with one object per category, in the same order as the text table. Each has the keys `category` (the name), `count` (how many expenses, an integer) and `total`, in that order.
- The top-level `count` and `total` are the same figures as the Total line of the text table.
- Amounts are plain JSON numbers rounded to cents: not strings, no thousands separators, no currency symbol. The text table shows `1,234.50`; the JSON has `1234.5`. Refunds stay negative.
- If there are no expenses (an empty file, a file with only the header row, or nothing left after `--month`), print `{"categories": [], "count": 0, "total": 0}` instead of the "No expenses found." line, and exit 0.
- `--month` and `--sort` work with both formats. Errors behave as they do now in either format: message on stderr, nothing on stdout, exit status 2.

Tests run with `python3 -m pytest -q`.
