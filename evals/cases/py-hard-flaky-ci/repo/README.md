# schedkit

Recurring-job rules and a small scheduler. Used by our batch service (several worker processes, each with its own scheduler) and by the `schedkit next` command that support uses to answer "when does this run?".

Python 3.11, standard library only. Tests: `python3 -m pytest`.

```python
from schedkit.scheduler import Scheduler

sched = Scheduler()                                  # or Scheduler(ManualClock(...)) in tests
sched.add("daily 09:00", send_digest, name="digest")
sched.add("weekly mon-fri 17:30", close_books)
sched.tick()                                         # run what is due; call it from a loop
```

```
$ python3 -m schedkit next "weekly mon,thu 09:00" -n 3 --from 2025-03-08T12:00Z
```

## Layout

| Path | What it holds |
|---|---|
| `schedkit/rules.py` | rule classes and `parse_rule()`: `daily`, `weekly`, `monthly`, `every` |
| `schedkit/timeutil.py` | the only place instants and local wall-clock times are converted into each other |
| `schedkit/clock.py` | `Clock`, `SystemClock`, `ManualClock` (what tests inject) |
| `schedkit/scheduler.py`, `jobs.py`, `store.py` | jobs, the in-memory store, `Scheduler.tick()` |
| `schedkit/calendar.py`, `holidays.py` | business days and public holidays |
| `schedkit/cron.py`, `serialize.py` | importing crontab lines, saving and restoring jobs |
| `schedkit/backoff.py`, `limiter.py`, `windows.py`, `metrics.py`, `retention.py`, `report.py`, `cli.py`, `naming.py` | the rest |
| `docs/` | `rules.md` (syntax and behaviour of rules), `timezones.md` (local time and daylight saving), `testing.md` (clocks, and how CI runs the tests) |
| `ci/` | the CI scripts and notes on the runners |
