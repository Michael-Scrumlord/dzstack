from datetime import date

from schedkit.holidays import calendar_for, nth_weekday, observed, us_federal


def test_nth_weekday():
    assert nth_weekday(2025, 11, 3, 4) == date(2025, 11, 27)  # fourth Thursday
    assert nth_weekday(2025, 1, 0, 3) == date(2025, 1, 20)  # third Monday
    assert nth_weekday(2025, 5, 0, -1) == date(2025, 5, 26)  # last Monday
    assert nth_weekday(2026, 5, 0, -1) == date(2026, 5, 25)


def test_observed_moves_weekend_holidays():
    assert observed(date(2026, 7, 4)) == date(2026, 7, 3)  # Saturday -> Friday
    assert observed(date(2027, 7, 4)) == date(2027, 7, 5)  # Sunday -> Monday
    assert observed(date(2025, 7, 4)) == date(2025, 7, 4)


def test_us_federal_2025():
    days = us_federal(2025)
    assert len(days) == 11
    assert date(2025, 11, 27) in days and date(2025, 12, 25) in days and date(2025, 9, 1) in days


def test_the_calendar_covers_the_years_asked_for():
    cal = calendar_for(range(2025, 2027))
    assert not cal.is_business_day(date(2026, 1, 1))
    assert cal.is_business_day(date(2027, 1, 4))
    try:
        calendar_for(range(2025, 2026), "mars")
    except ValueError as exc:
        assert "mars" in str(exc)
    else:
        raise AssertionError("an unknown region should be refused")
