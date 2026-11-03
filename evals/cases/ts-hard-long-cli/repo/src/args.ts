import { UsageError } from "./errors.ts";

/** What each option takes: a value, a value that may repeat, or nothing. */
export type OptionSpec = Record<string, "string" | "list" | "flag">;

export interface ParsedArgs {
  positionals: string[];
  values: Record<string, string>;
  lists: Record<string, string[]>;
  flags: Set<string>;
}

/**
 * Splits arguments into positionals and options. Options are `--name value` or `--name=value`;
 * the argument after `--name` is always its value, even when it starts with a dash. `--` ends
 * the options. A lone dash argument such as `-5` is a positional, and so is anything that does
 * not start with `--`. Problems are UsageErrors without a command: the caller adds it.
 */
export function parseOptions(args: string[], spec: OptionSpec): ParsedArgs {
  const parsed: ParsedArgs = { positionals: [], values: {}, lists: {}, flags: new Set() };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--") {
      parsed.positionals.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      parsed.positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const kind = Object.hasOwn(spec, name) ? spec[name] : undefined;
    if (kind === undefined) throw new UsageError(`unknown option "--${name}"`);
    if (kind === "flag") {
      if (eq !== -1) throw new UsageError(`option "--${name}" does not take a value`);
      parsed.flags.add(name);
      continue;
    }
    let value: string;
    if (eq !== -1) {
      value = arg.slice(eq + 1);
    } else {
      if (i + 1 >= args.length) throw new UsageError(`option "--${name}" needs a value`);
      value = args[++i] as string;
    }
    if (kind === "string") parsed.values[name] = value;
    else (parsed.lists[name] ??= []).push(value);
  }
  return parsed;
}
