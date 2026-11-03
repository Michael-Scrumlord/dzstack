The nightly export isn't safe to run twice, so in `jobs.json` I gave it `"retries": 0`:

```json
"nightly-export": {"command": "./export.sh", "retries": 0}
```

Last night it ran four times anyway. The log:

```
2026-03-02 02:00:00 INFO    nightly-export: starting (retries=3, timeout=300s)
2026-03-02 02:00:41 WARNING nightly-export: attempt 1/4 failed (exit status 1), retrying in 5s
2026-03-02 02:01:27 WARNING nightly-export: attempt 2/4 failed (exit status 1), retrying in 5s
2026-03-02 02:02:13 WARNING nightly-export: attempt 3/4 failed (exit status 1), retrying in 5s
2026-03-02 02:02:59 WARNING nightly-export: attempt 4/4 failed (exit status 1)
2026-03-02 02:02:59 ERROR   nightly-export: giving up after 4 attempts
```

Why did it do that, and can you fix it? Tests run with `python3 -m pytest -q`.
