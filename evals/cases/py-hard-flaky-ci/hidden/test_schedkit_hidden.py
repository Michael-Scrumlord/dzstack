"""Hidden checks. Expectations are computed here from zoneinfo and from docs/rules.md and docs/timezones.md, never from schedkit.
They run in a separate process per zone (TZ is set before Python starts) and, with HIDDEN_SEED, in a shuffled order."""
import calendar as pycalendar
import io
import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from schedkit.calendar import BusinessCalendar
from schedkit.cli import main as cli_main
from schedkit.clock import ManualClock
from schedkit.rules import Daily, Every, Monthly, Weekly, parse_rule
from schedkit.scheduler import Scheduler
from schedkit.serialize import dump_jobs, load_jobs

UTC = timezone.utc
TZNAME = os.environ.get("TZ") or "UTC"
ZONE = ZoneInfo(TZNAME)


def wall(day: date, at: time) -> datetime:
    """The instant a local wall-clock time stands for: first of two when it happens twice, the offset from before the
    jump when it does not exist (docs/timezones.md)."""
    return datetime.combine(day, at, tzinfo=ZONE).astimezone(UTC)


def ref_next(after: datetime, at: time, wanted=lambda d: True, skipped=frozenset()) -> datetime:
    day = after.astimezone(ZONE).date() - timedelta(days=1)
    for _ in range(800):
        if wanted(day) and day not in skipped:
            candidate = wall(day, at)
            if candidate > after:
                return candidate
        day += timedelta(days=1)
    raise AssertionError("no reference run found")


def transition_days(first=date(2025, 1, 1), last=date(2026, 12, 31)):
    """Local dates on which this zone's UTC offset changes, found from zoneinfo alone."""
    days, day = [], first
    offset = lambda d: datetime(d.year, d.month, d.day, 12, tzinfo=UTC).astimezone(ZONE).utcoffset()
    while day < last:
        if offset(day) != offset(day + timedelta(days=1)):  # it changed between those two noons (UTC): that day or the next
            days += [day, day + timedelta(days=1)]
        day += timedelta(days=1)
    return days


TRANSITIONS = transition_days()
AT_TIMES = [time(0, 0), time(0, 30), time(1, 0), time(1, 15), time(1, 30), time(1, 45), time(2, 0), time(2, 15), time(2, 30), time(2, 45), time(3, 0), time(3, 30), time(9, 0), time(23, 30)]


def probes(day: date, hours_before=30, hours_after=48, step=15):
    start = datetime(day.year, day.month, day.day, tzinfo=UTC) - timedelta(hours=hours_before)
    return [start + timedelta(minutes=step * i) for i in range((hours_before + hours_after) * 60 // step)]


def utc_iso(moment):
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class TestDst:
    @pytest.mark.parametrize("day", TRANSITIONS or [None], ids=str)
    def test_daily_next_after_matches_the_wall_clock_rules(self, day):
        if day is None:
            pytest.skip("this zone never changes its clocks")  # a zone without daylight saving time: nothing to test here
        for at in AT_TIMES:
            rule = Daily(f"daily {at:%H:%M}", at=at)
            for probe in probes(day):
                got = rule.next_after(probe)
                want = ref_next(probe, at)
                assert got == want, f"daily {at:%H:%M} after {utc_iso(probe)} in {TZNAME}: got {utc_iso(got)}, want {utc_iso(want)}"
                assert got > probe

    @pytest.mark.parametrize("day", TRANSITIONS or [None], ids=str)
    def test_weekly_and_monthly_rules_that_land_on_the_change_day(self, day):
        if day is None:
            pytest.skip("this zone never changes its clocks")
        for at in (time(1, 30), time(2, 30), time(3, 15), time(9, 0)):
            cases = [
                (parse_rule(f"weekly {('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[day.weekday()]} {at:%H:%M}"), lambda d, w=day.weekday(): d.weekday() == w),
                (parse_rule(f"weekly mon-sun {at:%H:%M}"), lambda d: True),
                (parse_rule(f"monthly {day.day} {at:%H:%M}"), lambda d, n=day.day: d.day == min(n, pycalendar.monthrange(d.year, d.month)[1])),
            ]
            for rule, wanted in cases:
                for probe in probes(day, hours_before=48, hours_after=48, step=30):
                    assert rule.next_after(probe) == ref_next(probe, at, wanted), f"{rule.text} after {utc_iso(probe)} in {TZNAME}"

    @pytest.mark.parametrize("day", TRANSITIONS or [None], ids=str)
    def test_consecutive_daily_runs_are_one_local_date_apart(self, day):
        if day is None:
            pytest.skip("this zone never changes its clocks")
        for at in (time(1, 30), time(2, 30), time(3, 30)):
            rule = Daily(f"daily {at:%H:%M}", at=at)
            start = datetime(day.year, day.month, day.day, tzinfo=UTC) - timedelta(days=4)
            runs = rule.occurrences(start, 8)
            dates = [r.astimezone(ZONE).date() for r in runs]
            assert [b - a for a, b in zip(dates, dates[1:])] == [timedelta(days=1)] * 7, f"{at} around {day} in {TZNAME}"
            for earlier, later in zip(runs, runs[1:]):
                assert timedelta(hours=22, minutes=30) <= later - earlier <= timedelta(hours=25, minutes=30)

    @pytest.mark.parametrize("day", TRANSITIONS or [None], ids=str)
    def test_a_scheduler_runs_each_job_once_per_date_at_the_right_instant(self, day):
        if day is None:
            pytest.skip("this zone never changes its clocks")
        for at in (time(1, 30), time(2, 30)):
            begin = datetime(day.year, day.month, day.day, tzinfo=UTC) - timedelta(days=2)
            clock = ManualClock(begin)
            sched = Scheduler(clock)
            runs = []
            sched.add(f"daily {at:%H:%M}", lambda: runs.append(clock.now()))
            for _ in range(5 * 24 * 6):
                clock.advance(timedelta(minutes=10))
                sched.tick()
            first_date = begin.astimezone(ZONE).date()
            want = [wall(first_date + timedelta(days=i), at) for i in range(-1, 8)]
            want = [w for w in want if begin < w <= clock.now()]
            assert len(runs) == len(want), f"{at} around {day} in {TZNAME}: {len(runs)} runs, expected {len(want)}"
            for run, due in zip(runs, want):
                assert due <= run < due + timedelta(minutes=10), f"ran at {utc_iso(run)}, due {utc_iso(due)}"

    @pytest.mark.parametrize("day", TRANSITIONS or [None], ids=str)
    def test_business_day_arithmetic_keeps_the_wall_clock_time(self, day):
        if day is None:
            pytest.skip("this zone never changes its clocks")
        week = BusinessCalendar(weekend=frozenset())

        def shifted(start: datetime, days: int) -> datetime:
            """The same local wall-clock time of day, `days` dates later (docs/timezones.md)."""
            local = start.astimezone(ZONE).replace(tzinfo=None)
            return wall(local.date() + timedelta(days=days), local.time())

        for offset in (-1, 0, 1):
            for at in (time(0, 15), time(1, 30), time(2, 30), time(3, 30), time(12, 0)):
                start = wall(day + timedelta(days=offset), at)
                for days in (1, -1, 2, -2, 0):
                    assert week.add_business_days(start, days) == shifted(start, days), f"{days:+d} days from {utc_iso(start)} in {TZNAME}"

    def test_the_command_line_prints_the_same_instants(self):
        if not TRANSITIONS:
            pytest.skip("this zone never changes its clocks")
        day = TRANSITIONS[0]
        start = datetime(day.year, day.month, day.day, tzinfo=UTC) - timedelta(days=1)
        out = io.StringIO()
        assert cli_main(["next", "daily 02:30", "-n", "3", "--from", utc_iso(start)], out) == 0
        want = []
        current = start
        for _ in range(3):
            current = ref_next(current, time(2, 30))
            want.append(utc_iso(current))
        assert [line.split()[0] for line in out.getvalue().splitlines()] == want

    def test_every_rules_and_instants_are_not_affected(self):
        rule = parse_rule("every 6 hours")
        for day in TRANSITIONS[:2] or [date(2025, 3, 9)]:
            start = datetime(day.year, day.month, day.day, tzinfo=UTC)
            assert rule.occurrences(start, 3) == [start + timedelta(hours=6 * n) for n in (1, 2, 3)]


class TestIsolation:
    """Polluters change the rules they parse and never put anything back; victims expect untouched rules.
    In a shuffled order any of them may come first."""

    def test_pollute_daily_skip(self):
        rule = parse_rule("daily 09:00")
        rule.skip(date(2025, 3, 10))
        rule.skip(date(2025, 3, 11))
        assert rule.next_after(wall(date(2025, 3, 9), time(10, 0))) == wall(date(2025, 3, 12), time(9, 0))

    def test_pollute_daily_attribute(self):
        rule = parse_rule("daily 09:00")
        rule.at = time(23, 59)

    def test_pollute_weekly(self):
        parse_rule("weekly mon-fri 09:00").skip(date(2025, 3, 12))
        rule = parse_rule("weekly mon-fri 09:00")
        rule.weekdays = (6,)

    def test_pollute_monthly(self):
        rule = parse_rule("monthly 15 09:00")
        rule.skip(date(2025, 3, 15))
        rule.day_of_month = 1

    def test_pollute_every(self):
        parse_rule("every 5 minutes").interval = timedelta(days=9)

    def test_pollute_through_a_scheduler_job(self):
        sched = Scheduler(ManualClock(datetime(2025, 3, 10, 6, tzinfo=UTC)))
        job = sched.add("weekly mon,wed 08:00", lambda: None, name="mon-wed")
        job.rule.skip(date(2025, 3, 12))
        job.rule.at = time(0, 5)

    def test_pollute_through_load_jobs(self):
        sched = Scheduler(ManualClock(datetime(2025, 3, 7, tzinfo=UTC)))
        sched.add("daily 06:00", lambda: None, name="early").rule.skip(date(2025, 3, 10))
        text = dump_jobs(sched)
        again = Scheduler(ManualClock(datetime(2025, 3, 7, tzinfo=UTC)))
        load_jobs(again, text, {"early": lambda: None})

    def test_victim_daily(self):
        rule = parse_rule("daily 09:00")
        assert rule.skipped == set() and rule.at == time(9, 0)
        assert rule.next_after(wall(date(2025, 3, 9), time(10, 0))) == wall(date(2025, 3, 10), time(9, 0))
        assert rule.next_after(wall(date(2025, 3, 10), time(10, 0))) == wall(date(2025, 3, 11), time(9, 0))

    def test_victim_weekly(self):
        rule = parse_rule("weekly mon-fri 09:00")
        assert rule.weekdays == (0, 1, 2, 3, 4) and rule.skipped == set()
        assert rule.next_after(wall(date(2025, 3, 11), time(10, 0))) == wall(date(2025, 3, 12), time(9, 0))

    def test_victim_monthly(self):
        rule = parse_rule("monthly 15 09:00")
        assert rule.day_of_month == 15 and rule.skipped == set()
        assert rule.next_after(wall(date(2025, 3, 1), time(0, 0))) == wall(date(2025, 3, 15), time(9, 0))

    def test_victim_every(self):
        rule = parse_rule("every 5 minutes")
        assert rule.interval == timedelta(minutes=5)

    def test_victim_scheduler_job(self):
        sched = Scheduler(ManualClock(datetime(2025, 3, 10, 6, tzinfo=UTC)))
        job = sched.add("weekly mon,wed 08:00", lambda: None, name="mon-wed")
        assert job.rule.skipped == set() and job.rule.at == time(8, 0) and job.rule.weekdays == (0, 2)
        assert job.rule.next_after(wall(date(2025, 3, 12), time(7, 0))) == wall(date(2025, 3, 12), time(8, 0))

    def test_victim_load_jobs(self):
        sched = Scheduler(ManualClock(datetime(2025, 3, 7, tzinfo=UTC)))
        (job,) = load_jobs(sched, '{"version": 1, "jobs": [{"name": "early", "rule": "daily 06:00"}]}', {"early": lambda: None})
        assert job.rule.skipped == set()
        assert job.rule.next_after(wall(date(2025, 3, 9), time(7, 0))) == wall(date(2025, 3, 10), time(6, 0))

    def test_parses_of_the_same_text_are_independent(self):
        for text, field, value in [
            ("daily 07:30", "at", time(1, 0)),
            ("weekly tue 07:30", "weekdays", (6,)),
            ("monthly 20 07:30", "day_of_month", 3),
            ("every 3 hours", "interval", timedelta(seconds=1)),
        ]:
            one, two = parse_rule(text), parse_rule(text)
            assert one is not two
            before = getattr(two, field)
            setattr(one, field, value)
            assert getattr(two, field) == before and getattr(parse_rule(text), field) == before

    def test_skipped_dates_are_not_shared_between_parses(self):
        for text in ("daily 07:45", "weekly mon-sun 07:45", "monthly 3 07:45"):
            one, two, three = parse_rule(text), parse_rule(text), parse_rule(text)
            one.skip(date(2025, 4, 3))
            assert one.skipped == {date(2025, 4, 3)}
            assert two.skipped == set() and three.skipped == set()
            two.skip(date(2025, 4, 4))
            assert one.skipped == {date(2025, 4, 3)} and three.skipped == set()
            one.unskip(date(2025, 4, 3))
            assert one.skipped == set() and two.skipped == {date(2025, 4, 4)}

    def test_two_schedulers_do_not_share_job_rules(self):
        a = Scheduler(ManualClock(datetime(2025, 3, 7, tzinfo=UTC)))
        b = Scheduler(ManualClock(datetime(2025, 3, 7, tzinfo=UTC)))
        ja = a.add("daily 05:10", lambda: None, name="x")
        jb = b.add("daily 05:10", lambda: None, name="x")
        ja.rule.skip(date(2025, 3, 8))
        assert jb.rule.skipped == set()
        assert jb.rule.next_after(wall(date(2025, 3, 7), time(6, 0))) == wall(date(2025, 3, 8), time(5, 10))
        assert ja.rule.next_after(wall(date(2025, 3, 7), time(6, 0))) == wall(date(2025, 3, 9), time(5, 10))

    def test_a_scheduler_job_keeps_the_skips_made_on_its_own_rule(self):
        sched = Scheduler(ManualClock(datetime(2025, 3, 7, 12, tzinfo=UTC)))
        job = sched.add("daily 05:10", lambda: None, name="x")
        job.rule.skip(date(2025, 3, 8))
        again = parse_rule("daily 05:10")
        assert date(2025, 3, 8) in job.rule.skipped and date(2025, 3, 8) not in again.skipped

    def test_rule_objects_built_directly_are_still_ordinary_mutable_objects(self):
        rule = Daily("by hand", at=time(7, 0))
        rule.skip(date(2025, 5, 5))
        assert rule.skipped == {date(2025, 5, 5)}
        assert Monthly("m", at=time(1, 0), day_of_month=2).describe() == "on day 2 of every month at 01:00"
        assert Weekly("w", at=time(1, 0), weekdays=(0,)).describe() == "every mon at 01:00"
        assert Every("e", interval=timedelta(hours=2)).describe() == "every 2 hours"
