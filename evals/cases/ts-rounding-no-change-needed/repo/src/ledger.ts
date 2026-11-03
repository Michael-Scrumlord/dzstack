import { formatAmount, roundHalfEven } from "./money.ts";

export interface LedgerEntry {
  memo: string;
  /** Usually whole cents; usage-based lines may carry fractions. */
  cents: number;
}

/**
 * The monthly ledger as plain text. Every line is rounded on its own and the total adds the
 * rounded lines, so the printed column always adds up to the printed total.
 */
export function renderLedger(entries: readonly LedgerEntry[]): string {
  const rows = entries.map((entry) => ({ memo: entry.memo, cents: roundHalfEven(entry.cents) }));
  const total = rows.reduce((sum, row) => sum + row.cents, 0);
  const width = Math.max(5, ...rows.map((row) => row.memo.length));
  const line = (memo: string, cents: number) => `${memo.padEnd(width)}  ${formatAmount(cents).padStart(12)}`;
  return [...rows.map((row) => line(row.memo, row.cents)), "-".repeat(width + 14), line("Total", total)].join("\n");
}
