# Recent red runs

Copied from the CI dashboard (newest last). "-" means the job runs in file order.

| Push | Job | Runner | TZ | Seed | Result |
|---|---|---|---|---|---|
| 5141 | unit | ci-utc-1 | UTC | - | passed |
| 5141 | unit-shuffled | ci-utc-2 | UTC | 20 | passed |
| 5142 | unit | ci-eu-1 | Europe/Berlin | - | **5 failed** |
| 5142 | unit-shuffled | ci-utc-3 | UTC | 1 | **1 failed** |
| 5143 | unit | ci-utc-1 | UTC | - | passed |
| 5143 | unit-shuffled | ci-utc-4 | UTC | 54 | passed |
| 5144 | unit | ci-utc-2 | UTC | - | passed |
| 5144 | unit-shuffled | ci-eu-1 | Europe/Berlin | 31 | **5 failed** |
| 5145 | unit | ci-utc-3 | UTC | - | passed |
| 5145 | unit-shuffled | ci-utc-1 | UTC | 12 | **1 failed** |
| 5146 | unit | ci-utc-4 | UTC | - | passed |
| 5146 | unit-shuffled | ci-utc-2 | UTC | 18 | **1 failed** |
| 5147 | unit | ci-utc-1 | UTC | - | passed |
| 5147 | unit-shuffled | ci-utc-3 | UTC | 3 | **2 failed** |
| 5148 | unit | ci-utc-2 | UTC | - | passed |
| 5148 | unit-shuffled | ci-utc-4 | UTC | 59 | passed |

Failed tests, as the dashboard shows them:

```
5142 unit-shuffled (seed 1)
  tests/test_scheduler.py::test_tick_runs_due_jobs_once_and_schedules_the_next
  tests/test_scheduler.py:35: ValueError: not enough values to unpack (expected 1, got 0)

5145 unit-shuffled (seed 12)
  tests/test_report.py::test_upcoming_lists_the_next_runs_in_local_time
  At index 1 diff: '2025-03-10 17:30 Mon  digest (every mon, thu at 17:30)' != '2025-03-10 09:00 Mon  report (every day at 09:00)'

5146 unit-shuffled (seed 18)
  tests/test_rules.py::test_daily_before_and_after_the_time

5147 unit-shuffled (seed 3)
  tests/test_scheduler.py::test_a_failing_job_backs_off_but_not_past_its_next_regular_run
  tests/test_scheduler.py::test_success_resets_the_failures

5142 unit (Europe/Berlin)
  tests/test_calendar.py::test_a_seven_day_calendar_moves_one_date_at_a_time_through_every_clock_change
  tests/test_rules.py::test_a_daily_rule_keeps_its_wall_clock_time_through_the_days_around_a_clock_change[2025-03-30]
  tests/test_rules.py::test_next_after_is_always_later_and_never_more_than_a_day_and_an_hour_away[2025-03-30]
  tests/test_rules.py::test_next_after_is_always_later_and_never_more_than_a_day_and_an_hour_away[2025-10-26]
  tests/test_scheduler.py::test_a_daily_job_runs_at_its_time_every_day_through_a_clock_change[2025-03-30]
  AssertionError: daily 02:30 around 2025-03-30
    At index 2 diff: datetime(2025, 3, 30, 0, 30, tzinfo=utc) != datetime(2025, 3, 30, 1, 30, tzinfo=utc)
```
