# expenses

A small command line tool that summarizes a CSV of expenses by category.

```
python3 -m expenses expenses.csv
python3 -m expenses expenses.csv --month 2024-03 --sort name
```

Python 3.11, standard library only. Tests: `python3 -m pytest -q`.

## Input

A CSV file with a header row. The columns `date`, `category` and `amount` are required and may come in any order; other columns (such as `description`) are ignored.

- `date` is `YYYY-MM-DD`.
- `category` is matched exactly after trimming spaces. An empty category becomes `Uncategorized`.
- `amount` is a decimal number. A thousands separator is allowed (`"1,200.00"`, quoted in the CSV). Amounts are rounded to cents, halves up. A **negative amount is a refund** and reduces its category's total.
- Blank lines are skipped. An empty file, or a file with only the header row, holds no expenses.

## Output

One row per category with the number of expenses and their total, then an overall line:

```
Category   Count     Total
---------  -----  --------
Rent           1  1,200.00
Groceries      3    168.70
---------  -----  --------
Total          4  1,368.70
```

Categories are listed by total, largest first; categories with equal totals are listed by name. With `--sort name` they are listed by name instead, ignoring case. Totals use a thousands separator and two decimals.

When there are no expenses (an empty file, or nothing left after `--month`), the output is the single line `No expenses found.` and the exit status is 0.

## Options

- `--month YYYY-MM` keeps only expenses dated in that month.
- `--sort {total,name}` chooses the order described above (default `total`).

## Errors

An unreadable file, a missing column, or a bad date or amount prints `expenses: <message>` to stderr, prints nothing to stdout and exits with status 2. Bad options are reported by argparse, also with status 2.
