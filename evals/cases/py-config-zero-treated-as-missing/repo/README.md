# jobrunner

Runs shell-command jobs described in a `jobs.json` file, with retries, a timeout per attempt, and a notification when a job gives up.

```
python3 -m jobrunner jobs.json
python3 -m jobrunner jobs.json --only nightly-export
```

Python 3.11, standard library only. Tests: `python3 -m pytest -q`. The exit status is 0 when every job succeeded or was skipped, 1 when a job failed, 2 for a bad config or options.

## jobs.json

```json
{
  "defaults": {"retries": 2, "timeout": 600},
  "jobs": {
    "nightly-export": {"command": "./export.sh", "retries": 0},
    "cleanup": {"command": "./cleanup.sh", "timeout": 0, "notify": []}
  }
}
```

`jobs` maps a job name to its settings. `defaults` (optional) holds settings shared by all jobs.

| Setting | Meaning | Built-in default |
|---|---|---|
| `command` | Shell command to run. Required, and only allowed in a job. | |
| `retries` | Extra attempts after a failure, a whole number. `0` runs the job once and never retries. | `3` |
| `timeout` | Seconds allowed per attempt. `0` means no time limit. | `300` |
| `retry_delay` | Seconds to wait between attempts. `0` retries immediately. | `5` |
| `enabled` | `false` skips the job (it is reported as skipped). | `true` |
| `notify` | Addresses told when the job gives up. `[]` tells nobody. | `["oncall@example.com"]` |
| `log_file` | File (relative to the base directory) that gets each attempt's output; `{name}` becomes the job name. `""` means no log file. | `"logs/{name}.log"` |

How a setting is chosen: the job's own value, else the value in `defaults`, else the built-in default. A setting that is `null` counts as not set. Any other value is used as written, including `0`, `false`, `[]` and `""`.

A value of the wrong type (a text `retries`, a number for `enabled`, a negative `timeout`) is a `ConfigError`, as are unknown settings and a missing `command`.

## Running

`run_job` makes up to `retries + 1` attempts, waiting `retry_delay` seconds between them. An attempt fails when the command exits non-zero or runs longer than `timeout`. When the last attempt fails the job is reported as failed and its `notify` addresses are told.

Progress goes to stderr as a log:

```
2026-03-02 02:00:00 INFO    nightly-export: starting (retries=3, timeout=300s)
2026-03-02 02:00:41 WARNING nightly-export: attempt 1/4 failed (exit status 1), retrying in 5s
```
