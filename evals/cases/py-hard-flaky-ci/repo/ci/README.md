# CI

Every push runs two jobs on whichever runners are free:

- `unit`: `python3 -m pytest -q`, tests in file order.
- `unit-shuffled`: `ci/run-tests.sh`, the same tests in a random order (the seed is printed at the top of the log).

The runners are listed in `runners.md`. Recent red runs, and what they said, are in `recent-failures.md`.

A red run is usually re-run by hand, and a second run is often green. That is how this file got started.
