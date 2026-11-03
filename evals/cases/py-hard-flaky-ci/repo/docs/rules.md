# Rules

A rule says when a job runs next. Write one as text and parse it with `parse_rule()`, or build the class directly.

| Text | Meaning |
|---|---|
| `daily 09:00` | every day at 09:00 |
| `weekly mon,wed,fri 09:00` | on those weekdays; ranges (`mon-fri`) and wrapping ranges (`sat-mon`) are fine |
| `monthly 15 09:00` | on the 15th; a day that the month does not have (31 in April) means the last day of the month |
| `every 90 minutes` | a plain duration (`minutes`, `hours`, `days`) after the previous run |

Times are 24-hour local times. Case and extra spaces do not matter.

## Methods

- `rule.next_after(moment)` returns the first run **strictly after** `moment`, as an aware UTC datetime. A naive `moment` is read as UTC.
- `rule.occurrences(moment, n)` returns the next `n` runs.
- `rule.skip(day)` makes the rule leave out that local calendar date; `rule.unskip(day)` undoes it. `every` rules run around the clock and cannot skip dates (`RuleError`).
- `rule.describe()` returns a sentence ("every day at 09:00").

## A rule belongs to whoever parsed it

Rule objects are mutable (`skip` changes the rule it is called on). Two rules parsed from the same text are independent: skipping a date on one never affects another job, another caller or another test. The scheduler and `load_jobs` rely on this, because a service has many jobs with the same `daily 09:00` and each one skips its own dates.

## Local time

Rules run on the machine's local time, including its daylight saving time. See `timezones.md`.
