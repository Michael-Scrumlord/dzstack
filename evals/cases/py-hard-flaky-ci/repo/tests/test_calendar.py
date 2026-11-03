from datetime import date, timedelta

from schedkit.calendar import BusinessCalendar
from tests.helpers import at

HOLIDAY = date(2025, 3, 12)  # a Wednesday
CAL = BusinessCalendar(holidays=frozenset({HOLIDAY}))


def test_weekends_and_holidays_are_not_business_days():
    assert CAL.is_business_day(date(2025, 3, 10))
    assert not CAL.is_business_day(date(2025, 3, 8))  # Saturday
    assert not CAL.is_business_day(date(2025, 3, 9))  # Sunday
    assert not CAL.is_business_day(HOLIDAY)


def test_next_business_day():
    assert CAL.next_business_day(date(2025, 3, 8)) == date(2025, 3, 10)
    assert CAL.next_business_day(date(2025, 3, 10)) == date(2025, 3, 10)
    assert CAL.next_business_day(HOLIDAY) == date(2025, 3, 13)


def test_business_days_between_counts_the_start_but_not_the_end():
    assert CAL.business_days_between(date(2025, 3, 10), date(2025, 3, 14)) == 3  # Mon, Tue, Thu (Wed is a holiday)
    assert CAL.business_days_between(date(2025, 3, 14), date(2025, 3, 10)) == -3
    assert CAL.business_days_between(date(2025, 3, 8), date(2025, 3, 10)) == 0


def test_add_business_days_keeps_the_wall_clock_time():
    assert CAL.add_business_days(at(2025, 3, 7, 9, 30), 1) == at(2025, 3, 10, 9, 30)  # Friday -> Monday
    assert CAL.add_business_days(at(2025, 3, 11, 9, 30), 1) == at(2025, 3, 13, 9, 30)  # over the holiday
    assert CAL.add_business_days(at(2025, 3, 13, 9, 30), -1) == at(2025, 3, 11, 9, 30)  # back over the holiday
    assert CAL.add_business_days(at(2025, 3, 13, 9, 30), -2) == at(2025, 3, 10, 9, 30)
    assert CAL.add_business_days(at(2025, 3, 7, 9, 30), 0) == at(2025, 3, 7, 9, 30)


def test_a_seven_day_calendar_moves_one_date_at_a_time_through_every_clock_change():
    week = BusinessCalendar(weekend=frozenset())
    for day in (date(2025, 3, 9), date(2025, 3, 30), date(2025, 10, 26), date(2025, 11, 2)):
        before = day - timedelta(days=1)
        for hour, minute in [(0, 15), (2, 30), (12, 0)]:
            expected = at(day.year, day.month, day.day, hour, minute)
            assert week.add_business_days(at(before.year, before.month, before.day, hour, minute), 1) == expected, f"{day} {hour}:{minute}"
