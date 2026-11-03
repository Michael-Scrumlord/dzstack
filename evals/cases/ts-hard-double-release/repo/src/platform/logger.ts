export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  fields?: Record<string, unknown>;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** Keeps entries in memory; the default for tests and for `createApp()` without a logger. */
export function createMemoryLogger(): Logger & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  const add = (level: LogLevel) => (message: string, fields?: Record<string, unknown>) => {
    entries.push({ level, message, fields });
  };
  return { entries, info: add("info"), warn: add("warn"), error: add("error") };
}

export function createConsoleLogger(): Logger {
  const write = (level: LogLevel) => (message: string, fields?: Record<string, unknown>) => {
    const line = JSON.stringify({ level, message, ...fields });
    if (level === "error") console.error(line);
    else console.log(line);
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}
