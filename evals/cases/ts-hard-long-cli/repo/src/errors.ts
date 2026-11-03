/**
 * An error the command line reports on standard error and turns into an exit code. Usage and
 * command errors are printed as `tasks: <command>: <message>`, the others as `tasks: <message>`.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Wrong arguments: exit code 2. */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

/** A valid request that cannot be carried out (no such task, nothing to undo): exit code 1. */
export class CommandError extends CliError {
  constructor(message: string) {
    super(message, 1);
  }
}

/** The store file is there but is not a task store: exit code 65. */
export class DataError extends CliError {
  constructor(message: string) {
    super(message, 65);
  }
}

/** The store file cannot be read or written: exit code 74. */
export class IoError extends CliError {
  constructor(message: string) {
    super(message, 74);
  }
}
