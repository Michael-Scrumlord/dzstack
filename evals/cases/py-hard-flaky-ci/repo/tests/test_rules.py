from datetime import date, time, timedelta

import pytest

from schedkit.errors import RuleError, RuleSyntaxError
from schedkit.rules import Daily, Every, Monthly, Weekly, parse_rule
from schedkit.timeutil import local_zone
from tests.helpers import TRANSITION_DAYS, at, quarter_hours, utc


def test_daily_before_and_after_the_time():
    rule = parse_rule("daily 09:00")
    assert rule.next_after(at(2025, 3, 10, 8, 0)) == at(2025, 3, 10, 9, 0)
    assert rule.next_after(at(2025, 3, 10, 9, 0)) == at(2025, 3, 11, 9, 0)
    assert rule.next_after(at(2025, 3, 10, 23, 59)) == at(2025, 3, 11, 9, 0)


def test_the_result_is_aware_utc():
    run = parse_rule("daily 09:00").next_after(at(2025, 1, 15, 8, 0))
    assert run.utcoffset() == timedelta(0)


def test_naive_input_is_read_as_utc():
    rule = parse_rule("daily 09:00")
    assert rule.next_after(utc(2025, 1, 15, 8).replace(tzinfo=None)) == rule.next_after(utc(2025, 1, 15, 8))


def test_weekly_runs_on_the_listed_days():
    rule = parse_rule("weekly mon,wed,fri 09:00")
    runs = rule.occurrences(at(2025, 1, 12, 12, 0), 4)  # a Sunday
    assert runs == [at(2025, 1, 13, 9), at(2025, 1, 15, 9), at(2025, 1, 17, 9), at(2025, 1, 20, 9)]


def test_weekly_ranges_and_wraparound():
    assert parse_rule("weekly mon-fri 08:30").weekdays == (0, 1, 2, 3, 4)
    assert parse_rule("weekly sat-mon 08:30").weekdays == (0, 5, 6)


def test_monthly_clips_to_the_last_day():
    rule = parse_rule("monthly 31 06:00")
    runs = rule.occurrences(at(2025, 1, 1), 4)
    assert [r.astimezone(local_zone()).date() for r in runs] == [date(2025, 1, 31), date(2025, 2, 28), date(2025, 3, 31), date(2025, 4, 30)]


def test_every_is_a_plain_duration():
    rule = parse_rule("every 90 minutes")
    start = utc(2025, 1, 15, 8)
    assert rule.occurrences(start, 2) == [utc(2025, 1, 15, 9, 30), utc(2025, 1, 15, 11)]
    assert parse_rule("every 2 days").next_after(start) == utc(2025, 1, 17, 8)


def test_describe():
    assert parse_rule("daily 09:00").describe() == "every day at 09:00"
    assert parse_rule("weekly tue,thu 17:45").describe() == "every tue, thu at 17:45"
    assert parse_rule("monthly 15 09:00").describe() == "on day 15 of every month at 09:00"
    assert parse_rule("every 15 minutes").describe() == "every 15 minutes"
    assert parse_rule("every 24 hours").describe() == "every 1 day"


@pytest.mark.parametrize(
    "text, message",
    [
        ("", "empty rule"),
        ("daily", "expected daily HH:MM"),
        ("daily 25:00", "not a time of day"),
        ("daily 9am", "not a time of day"),
        ("weekly someday 09:00", "not a weekday"),
        ("monthly 32 09:00", "1 to 31"),
        ("every 0 minutes", "expected daily"),
        ("every 5 fortnights", "expected daily"),
        ("yearly 09:00", "expected daily"),
    ],
)
def test_syntax_errors(text, message):
    with pytest.raises(RuleSyntaxError, match=message):
        parse_rule(text)


def test_rules_can_be_built_directly():
    rule = Daily("by hand", at=time(7, 15))
    assert rule.next_after(at(2025, 1, 15, 7, 0)) == at(2025, 1, 15, 7, 15)
    assert isinstance(Weekly("w", at=time(1, 0), weekdays=(2,)), Weekly) and isinstance(Monthly("m"), Monthly)
    assert Every("e", interval=timedelta(hours=1)).next_after(utc(2025, 1, 1)) == utc(2025, 1, 1, 1)


def test_a_skipped_date_is_left_out():
    rule = Daily("daily 06:45", at=time(6, 45))
    rule.skip(date(2025, 2, 11))
    assert rule.next_after(at(2025, 2, 10, 7)) == at(2025, 2, 12, 6, 45)
    rule.unskip(date(2025, 2, 11))
    assert rule.next_after(at(2025, 2, 10, 7)) == at(2025, 2, 11, 6, 45)


def test_every_rules_cannot_skip():
    with pytest.raises(RuleError, match="cannot skip"):
        parse_rule("every 5 minutes").skip(date(2025, 1, 1))


def test_parsing_ignores_case_and_spacing():
    assert parse_rule("  DAILY   09:00 ").at == time(9, 0)


@pytest.mark.parametrize("day", TRANSITION_DAYS, ids=str)
def test_a_daily_rule_keeps_its_wall_clock_time_through_the_days_around_a_clock_change(day):
    for hour, minute in [(0, 30), (1, 30), (2, 30), (3, 30), (9, 0)]:
        rule = Daily(f"daily {hour:02d}:{minute:02d}", at=time(hour, minute))
        before = day - timedelta(days=3)
        runs = rule.occurrences(at(before.year, before.month, before.day, 12), 7)
        # "the same time on the next date": built from dates, not by adding 24 hours
        dates = [day + timedelta(days=o) for o in range(-2, 5)]
        expected = [at(d.year, d.month, d.day, hour, minute) for d in dates]
        assert runs == expected, f"daily {hour:02d}:{minute:02d} around {day}"


@pytest.mark.parametrize("day", TRANSITION_DAYS, ids=str)
def test_next_after_is_always_later_and_never_more_than_a_day_and_an_hour_away(day):
    start = utc(day.year, day.month, day.day) - timedelta(days=1)
    for text in ("daily 01:30", "daily 02:30", "daily 09:00"):
        rule = parse_rule(text)
        for probe in quarter_hours(start, 72):
            run = rule.next_after(probe)
            assert run > probe, f"{text} after {probe:%Y-%m-%d %H:%M}Z gave {run:%Y-%m-%d %H:%M}Z"
            assert run - probe <= timedelta(hours=25), f"{text} after {probe:%Y-%m-%d %H:%M}Z gave {run:%Y-%m-%d %H:%M}Z"
