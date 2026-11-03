import { parseOptions } from "../args.ts";
import { UsageError } from "../errors.ts";
import { formatTable, listOrder } from "../format.ts";
import type { Context } from "../cli.ts";

/** `tasks list [--all]`: open tasks by urgency; with --all, done tasks too. */
export function list(ctx: Context, args: string[]): number {
  const { positionals, flags } = parseOptions(args, { all: "flag" });
  if (positionals.length > 0) throw new UsageError(`unexpected argument "${positionals[0]}"`);
  const store = ctx.load();
  const shown = store.tasks.filter((task) => flags.has("all") || task.status === "open");
  ctx.io.stdout(formatTable(listOrder(shown)));
  return 0;
}
