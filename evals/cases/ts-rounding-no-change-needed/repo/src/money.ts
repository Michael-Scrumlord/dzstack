// Money is held as integer cents. Fractional cents (usage-based prices, pro-rata
// charges) are rounded once, at the edge, with roundHalfEven.

export interface FormatOptions {
  /** Put in front of the amount. Default "$". */
  symbol?: string;
}

/**
 * Rounds to a whole number with ties going to the even neighbour ("banker's rounding"):
 * 2.5 becomes 2, 3.5 becomes 4, 12.5 becomes 12.
 *
 * This is deliberate. The finance team requires half-to-even for every figure in the
 * ledger reports so that rounding error cancels out instead of drifting upwards over
 * thousands of lines (see the README, "Rounding"). Do not switch this to round-half-up
 * without finance's sign-off.
 */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Dollars to cents. Rounds half to even, like everything else here. */
export function fromDollars(dollars: number): number {
  // 1.015 * 100 is 101.49999999999999 in floating point; trim that noise before rounding.
  return roundHalfEven(Number((dollars * 100).toPrecision(12)));
}

/** "$1,234.56" for 123456 cents. Fractional cents are rounded with roundHalfEven. */
export function formatAmount(cents: number, options: FormatOptions = {}): string {
  const symbol = options.symbol ?? "$";
  const rounded = roundHalfEven(cents);
  const abs = Math.abs(rounded);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = String(abs % 100).padStart(2, "0");
  return `${rounded < 0 ? "-" : ""}${symbol}${whole}.${fraction}`;
}

export function formatDollars(dollars: number, options: FormatOptions = {}): string {
  return formatAmount(fromDollars(dollars), options);
}

/** "$1,234.56", "-12.5" or "7" to whole cents. Throws on anything else. */
export function parseAmount(text: string): number {
  const match = /^(-)?\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) throw new RangeError(`not an amount: ${JSON.stringify(text)}`);
  const cents = Number(match[2].replace(/,/g, "")) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] && cents !== 0 ? -cents : cents;
}

/** Splits whole cents into `parts` shares that add up exactly; earlier shares get the extra cents. */
export function splitEvenly(cents: number, parts: number): number[] {
  if (!Number.isInteger(cents)) throw new RangeError(`splitEvenly needs whole cents, got ${cents}`);
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError(`parts must be a positive integer, got ${parts}`);
  const base = Math.floor(cents / parts);
  const extra = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
