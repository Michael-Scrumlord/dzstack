# tasks

A small command-line to-do list. Everything lives in one JSON file; there are no dependencies (Node 24 runs the TypeScript directly).

```
node src/main.ts list
node src/main.ts --store ~/work.json list --all
npm test
```

- `docs/SPEC.md`: what each command does, exactly: arguments, output, exit codes, error messages.
- `docs/STORE.md`: the file format.

## Layout

| File | What it does |
|---|---|
| `src/main.ts` | the entry point: passes the arguments and the environment to `run` and sets the exit code |
| `src/cli.ts` | `run(argv, io)`: global options, the command table, error reporting; `Context` is what a command gets |
| `src/args.ts` | `parseOptions`: `--name value`, `--name=value`, repeatable options, flags |
| `src/commands/` | one file per command |
| `src/storage.ts` | reading and writing the store file, and the file-system functions it uses |
| `src/task.ts`, `format.ts`, `text.ts`, `errors.ts` | the types, the table `list` prints, text helpers, the errors that become exit codes |

Commands are functions `(ctx, args) => exit code`. They throw a `UsageError` (exit code 2) or a `CommandError` (exit code 1) with just the message; `run` adds the `tasks: <command>: ` prefix.
