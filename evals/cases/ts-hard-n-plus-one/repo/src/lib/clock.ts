export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

/** ISO-8601 in UTC without milliseconds, the format every timestamp column uses. */
export function stamp(clock: Clock): string {
  return clock().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function daysAgo(clock: Clock, days: number): string {
  const d = clock();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
