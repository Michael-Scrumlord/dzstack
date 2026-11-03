# Testing

## Clocks

Nothing in schedkit reads the system time directly: the scheduler, the token bucket and history pruning all take a `Clock`. Tests use `ManualClock(start)` and move it with `advance()` or `set()`. `tests/helpers.py` has `at(...)` (the instant a local wall-clock time stands for) and `clock_at(...)` for building them.

## Zones

The local zone comes from `TZ` (see `timezones.md`), so run the suite under a few zones before touching anything that converts times, for example `TZ=America/New_York python3 -m pytest`.

## Random order

CI runs the suite in random order as well as in file order, to catch tests that only pass when another test ran first. `tests/conftest.py` shuffles the tests when `CI_SHUFFLE_SEED` is set:

```
CI_SHUFFLE_SEED=1234 python3 -m pytest      # the same order every time for the same seed
```

`ci/run-tests.sh` picks a seed, prints it, and runs that. The seed of a red run is in its log (`ci/recent-failures.md` has examples).
