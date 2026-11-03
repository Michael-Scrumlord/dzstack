import type { Context } from "../cli.ts";

export const USAGE = `Usage: tasks [--store PATH] <command> [arguments]

Commands:
  list [--all]            list open tasks
  help                    show this text
`;

export function help(ctx: Context): number {
  ctx.io.stdout(USAGE);
  return 0;
}
