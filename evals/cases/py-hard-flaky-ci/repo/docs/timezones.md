# Time zones and daylight saving time

Clocks, run records and job stores deal in aware UTC datetimes. Rules are written in **local time**: "daily 09:00" means 09:00 where the scheduler runs. The local zone is the IANA name in the `TZ` environment variable (`Europe/Berlin`), or UTC when `TZ` is not set. It is read every time it is needed. `schedkit/timeutil.py` holds the conversions between the two; nothing else converts.

## What a rule does when the clocks change

- A daily, weekly or monthly rule runs at the same **wall-clock time** on every date it is due, whatever the UTC offset that day. Consecutive runs of a daily rule are one local calendar date apart: 23, 24 or 25 hours.
- **Clocks go forward** (a wall-clock time does not exist: 02:30 on 2025-03-09 in New York, where 02:00 jumps to 03:00): the rule still runs on that date, at the instant that wall-clock time would have had with the offset from before the change. 02:30 EST is 07:30 UTC, which the clocks show as 03:30 EDT. It never runs early, never twice and is never skipped.
- **Clocks go back** (a wall-clock time happens twice: 01:30 on 2025-11-02 in New York): the rule runs at the first of the two, once.
- `next_after(moment)` is always strictly later than `moment`, also for a `moment` that falls in the repeated hour.
- `every N hours` is a plain duration and is not affected.

`BusinessCalendar.add_business_days` keeps the local wall-clock time of the datetime it is given, with the same two rules for times that do not exist or happen twice.

## Comparing instants

Two aware datetimes in different zones are compared by the instant they stand for, except when one of them is a wall-clock time that does not exist or happens twice: Python never calls those equal to a datetime in another zone (PEP 495). Convert to UTC before comparing, as schedkit does.
