# tasks: specification

`tasks` keeps a to-do list in one JSON file (format: `docs/STORE.md`). `list` and `help` exist. This document specifies those and the commands still missing: `add`, `done`, `undo`, `edit` and `report`, and how the file is written. Where the code already does what is written here, it stays as it is.

Run it as `node src/main.ts [--store PATH] <command> [arguments]`.

## Conventions

**Store file.** `--store PATH` (before the command) wins, then the environment variable `TASKS_FILE`, then `tasks.json` in the current directory.

**Results.** A command that succeeds prints its output on standard output and exits with 0. A command that fails prints nothing on standard output, one line on standard error, exits with a non-zero code, and does not touch the store file.

| Exit code | When |
|---|---|
| 0 | success |
| 1 | the request is valid but cannot be carried out: no such task, nothing to undo, a tag the task does not have |
| 2 | usage: unknown command or option, a missing or invalid argument or value |
| 65 | the store file exists but is not a valid store |
| 74 | the store file cannot be read or written |

Error lines are `tasks: <command>: <message>` for exit codes 1 and 2, and `tasks: <message>` for 65 and 74 and for an unknown command (the messages below are the part after the prefix). `src/cli.ts` adds the prefix: a command throws `UsageError` or `CommandError` with just the message.

**Order of checks.** A command checks its arguments in the order listed under it and before it reads the store, so a usage error (2) wins over "no such task" (1), and a damaged store (65) is only noticed once the arguments are fine.

**Options.** As parsed by `src/args.ts`: `--name value` or `--name=value`, options may repeat only where a command says so, and a problem is reported as `unknown option "--x"` or `option "--x" needs a value`.

**Today.** The environment variable `TASKS_TODAY` (`YYYY-MM-DD`) sets today's date; without it, today is the local date of the machine. A `TASKS_TODAY` that is not a real date makes any command that needs today's date (`add`, `done`, `report`, and `edit` when it resolves a relative date) fail with exit code 2 and `TASKS_TODAY must be a date like 2026-05-01`.

## Dates

Wherever a command takes a date (`--due`, `--since`) it accepts:

- `YYYY-MM-DD`: a real calendar day with a four-digit year from 1000 to 9999 (`2028-02-29` is real, `2026-02-29` and `2100-02-29` are not);
- `today`, `tomorrow`, `yesterday`;
- `+Nd` or `-Nd`: N days after or before today; `+Nw` or `-Nw`: N weeks (7N days). N is one to four digits and may be 0.

Lower case only, no spaces. Relative dates are counted in calendar days from today, so month ends, leap days and daylight saving time do not matter. A result outside the years 1000 to 9999 is invalid. Dates are stored as `YYYY-MM-DD`. Anything else is a usage error: `invalid date "<the text as given>" (expected YYYY-MM-DD, today, tomorrow, yesterday, +Nd, -Nd, +Nw or -Nw)`.

## Values

- **Title:** 1 to 80 characters after trimming.
- **Priority:** `high`, `normal` or `low`, lower case. Otherwise: `invalid priority "<as given>" (expected high, normal or low)`.
- **Tag:** trimmed and lower-cased, then it must match `[a-z0-9][a-z0-9_-]{0,19}`. Otherwise: `invalid tag "<as given>"`. Equal tags collapse into one. A task's tags are kept in ascending order (plain string comparison). A task has at most 10: `a task has at most 10 tags`.
- **Note:** trimmed; at most 500 characters (`note is longer than 500 characters`); empty means no note (`null`).
- **Task id:** `[1-9][0-9]*`. Otherwise: `invalid id "<as given>"`.

## Writing the store

Every command that changes the store writes it like this, and nothing else writes to the store path:

1. Serialise the store as in `docs/STORE.md`.
2. Write the text to `<store path>.<process id>.tmp`, next to the store file, with `writeFileSync`.
3. `renameSync` that file over the store path.

If step 2 or 3 fails, the temp file is removed with `unlinkSync` (a failure to remove it is ignored), the store file is left exactly as it was, and the command fails with exit code 74 and `cannot save <store path>: <the error's message>`. A process that is killed between the steps leaves its temp file behind and the store as it was; later runs do not read it and do not mind it. A command that changes nothing does not write.

**Test hook.** If the environment variable `TASKS_FS_HOOK` is set to the absolute path of a module, the program imports it (ES module, `import()`) before running the command. Each of its exports named `readFileSync`, `writeFileSync`, `renameSync` or `unlinkSync` replaces the `node:fs` function of that name wherever `src/storage.ts` uses it: it is called with the same arguments, and what it returns or throws is used as is. Other exports are ignored. Tests use this to make a write fail or to stop the process half way.

## The journal

The store's `journal` holds what `undo` can take back, oldest first, at most 10 entries: adding an eleventh drops the oldest. A change that is written adds its entry in the same write; a command that changes nothing adds none. Entry shapes are in `src/task.ts`:

- `{ "op": "add", "id": 4 }`
- `{ "op": "done", "ids": [3, 5] }`: the tasks that were open and became done, in the order they were given
- `{ "op": "edit", "id": 3, "before": { "title": "Old", "due": null } }`: the previous values of the fields that changed, in the order title, due, priority, note, tags

## Commands

### help

`tasks help` prints this text and exits with 0. `tasks` with no command prints it on standard error and exits with 2.

```
Usage: tasks [--store PATH] <command> [arguments]

Commands:
  add <title...> [options]  add a task
  done <id>...              mark tasks done
  undo                      undo the last change
  edit <id> [options]       change a task
  list [--all]              list open tasks
  report [options]          summarise the tasks
  help                      show this text
```

### list

`tasks list [--all]` is as it is today (`src/commands/list.ts`).

### add

`tasks add <title...> [--due DATE] [--priority P] [--tag TAG]... [--note TEXT]`

Checks, in this order (exit code 2):

1. The options.
2. The title is all positional arguments joined with single spaces, then trimmed. Empty: `missing title`. Longer than 80: `title is longer than 80 characters`.
3. `--priority`, 4. `--due`, 5. `--tag` (each may repeat, and tags are checked in the order given; then the limit of 10), 6. `--note`.

The new task gets the id `nextId` (which then goes up by one), `status` `open`, `priority` `normal` unless given, `due` as given (or `null`), the tags, the note (or `null`), `createdAt` today and `completedAt` `null`. Journal entry: `add`.

Output: `Added #<id>: <title>`, followed by ` (due <date>)` when the task has a due date. Example: `Added #4: Buy milk (due 2026-05-03)`.

### done

`tasks done <id>...`

Checks (exit code 2): at least one id (`missing task id`); then every id, left to right (`invalid id "abc"`). Then the store is read: ids that appear twice count once (first position); the first id in argument order that is not a task fails with exit code 1 and `no task #9`, and nothing is changed, not even for the valid ids before it.

Then for each id in argument order: a task that is already done prints `Task #3 is already done`; an open task becomes done with `completedAt` today and prints `Done #3: Buy milk`. Journal entry: `done` with the ids of the tasks that changed. When none changed, nothing is written and the exit code is still 0.

### undo

`tasks undo`

An argument is a usage error: `unexpected argument "x"` (the first one). An empty journal fails with exit code 1 and `nothing to undo`.

Otherwise the newest journal entry is removed and reverted, the store is written, and one line is printed per task, in the order of the entry:

- `add`: the task is removed (`nextId` stays as it is: ids are never reused). Prints `Undid add #4: Buy milk` (the title the task had).
- `done`: each task becomes open again with `completedAt` `null`. Prints `Undid done #3: Buy milk`.
- `edit`: the saved fields get their old values back. Prints `Undid edit #3: Buy milk` (the title after the revert).

`undo` adds no journal entry, so repeating it walks back through the journal.

### edit

`tasks edit <id> [--title TEXT] [--due DATE|none] [--priority P] [--note TEXT] [--tag TAG]... [--add-tag TAG]... [--remove-tag TAG]...`

Checks, in this order (exit code 2):

1. The options.
2. The id: none `missing task id`; not valid `invalid id "x"`; a second positional `unexpected argument "x"`.
3. At least one of the options above: `nothing to change`.
4. `--tag` together with `--add-tag` or `--remove-tag`: `--tag cannot be combined with --add-tag or --remove-tag`.
5. `--title`: trimmed, empty is `title must not be empty`, longer than 80 as for `add`.
6. `--priority`, 7. `--due` (`none` clears the due date; otherwise a date), 8. `--note` (an empty value clears the note), 9. the tags of `--tag`, `--add-tag` and `--remove-tag` in that order, valid as for `add`.
10. A tag in both `--add-tag` and `--remove-tag`: `"x" is both added and removed` (the tag as normalised).

Then the store is read. An id that is not a task fails with exit code 1 and `no task #9`. `--remove-tag` of a tag the task does not have fails with exit code 1 and `task #3 has no tag "x"` (the first such tag, as normalised). A tag list that would end up with more than 10 tags fails with exit code 1 and `task #3 would have more than 10 tags`. Nothing is changed in either case.

The new tag list is: `--tag` replaces the list; otherwise the current tags plus `--add-tag`, minus `--remove-tag`. A field counts as changed only if its new value differs from the current one. Editing a done task is allowed.

- Nothing changed: prints `No changes to #3`, exits 0, writes nothing, adds no journal entry.
- Otherwise the changes are applied and written, the journal entry is `edit` with the old values of the changed fields, and it prints `Edited #3 (title, due)`: the changed fields in the order title, due, priority, note, tags, separated by `, `.

### report

`tasks report [--format text|json] [--tag TAG] [--priority P] [--since DATE]`

Checks (exit code 2): the options; an argument: `unexpected argument "x"`; `--format` other than `text` or `json`: `invalid format "xml" (expected text or json)`; `--tag`, `--priority`, `--since`, valid as above. Then the store is read. `report` never writes.

**Selection.** The tasks that match every filter given: `--tag` (the task has the tag), `--priority`, `--since` (the task was created on that day or later). All the figures below are about the selected tasks, and "today" is today's date.

- `total`, `open` and `done`: how many.
- `overdue`: open tasks with a due date before today. `dueSoon`: open tasks due from today to 7 days after today, both ends included. Each is ordered by due date, then priority (high first), then id.
- `openByPriority`: how many open tasks have each priority.
- `completedLast7Days`: done tasks with `completedAt` from 6 days before today to today, both ends included.

**Text format** (the default), with a newline after every line:

```
Report for 2026-05-01
Filter: tag=home, priority=high, since=2026-04-01
Tasks: 7 (open 5, done 2)
Overdue (2):
  #3 2026-04-28 high Pay rent [home,money]
  #1 2026-04-30 normal Call dentist
Due in the next 7 days (1):
  #5 2026-05-04 low Water plants
Open by priority: high 2, normal 2, low 1
Completed in the last 7 days: 1
```

- The `Filter:` line is there only when a filter was given. It lists the filters given, in the order tag, priority, since, as `tag=<normalised tag>`, `priority=<priority>` and `since=<the date as YYYY-MM-DD>`, separated by `, `.
- A task line is two spaces, `#<id>`, the due date, the priority and the title, separated by single spaces, followed by ` [<tags joined by commas>]` when the task has tags.
- A section with no tasks prints its heading with `(0)` and then the line `  none`.

**JSON format** (`--format json`): `JSON.stringify(report, null, 2)` and a newline, where `report` has these keys in this order: `date` (today), `filter` (`{ "tag": ..., "priority": ..., "since": ... }`, each `null` when not given), `total`, `open`, `done`, `overdue` (the ids), `dueSoon` (the ids), `openByPriority` (`{ "high": n, "normal": n, "low": n }`) and `completedLast7Days`. The values in `filter` are the same as in the text format's `Filter:` line.
