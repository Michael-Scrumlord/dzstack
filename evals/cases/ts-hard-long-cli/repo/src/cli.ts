import { CliError, UsageError } from "./errors.ts";
import { list } from "./commands/list.ts";
import { help, USAGE } from "./commands/help.ts";
import { loadFsApi, readStore, writeStore } from "./storage.ts";
import type { FsApi } from "./storage.ts";
import type { Store } from "./task.ts";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
  env: NodeJS.ProcessEnv;
}

/** What a command gets: output, the store, and today's date. */
export interface Context {
  io: Io;
  storePath: string;
  /** Today as YYYY-MM-DD (see docs/SPEC.md, "Today"). */
  today(): string;
  load(): Store;
  save(store: Store): void;
}

export type Command = (ctx: Context, args: string[]) => number | void | Promise<number | void>;

export const COMMANDS: Record<string, Command> = {
  list,
  help,
};

function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Splits `--store PATH` off the front and returns the command and its arguments. */
function splitGlobalOptions(argv: string[], env: NodeJS.ProcessEnv) {
  let storePath = env.TASKS_FILE || "tasks.json";
  let i = 0;
  while (i < argv.length && (argv[i] === "--store" || (argv[i] as string).startsWith("--store="))) {
    const arg = argv[i] as string;
    if (arg === "--store") {
      if (i + 1 >= argv.length) throw new UsageError('option "--store" needs a value');
      storePath = argv[i + 1] as string;
      i += 2;
    } else {
      storePath = arg.slice("--store=".length);
      i += 1;
    }
  }
  return { storePath, rest: argv.slice(i) };
}

/** Runs the command line and returns the exit code. Nothing in here exits the process. */
export async function run(argv: string[], io: Io): Promise<number> {
  let command: string | undefined;
  try {
    const { storePath, rest } = splitGlobalOptions(argv, io.env);
    const [name, ...args] = rest;
    if (name === undefined) {
      io.stderr(USAGE);
      return 2;
    }
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
    if (!handler) throw new UsageError(`unknown command "${name}"`);
    command = name;

    const fs: FsApi = await loadFsApi(io.env);
    const ctx: Context = {
      io,
      storePath,
      today: () => io.env.TASKS_TODAY ?? localDate(new Date()),
      load: () => readStore(storePath, fs),
      save: (store) => writeStore(storePath, store, fs),
    };
    const code = await handler(ctx, args);
    return code ?? 0;
  } catch (error) {
    if (error instanceof CliError) {
      const aboutCommand = error.exitCode === 1 || error.exitCode === 2;
      const prefix = aboutCommand && command ? `tasks: ${command}: ` : "tasks: ";
      io.stderr(`${prefix}${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
