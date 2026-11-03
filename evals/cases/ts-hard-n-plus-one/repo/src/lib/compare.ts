/** Code-unit comparison, the same one the database uses for strings. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Case-insensitive comparison: lowercase both sides, then compare by code unit. */
export function cmpNoCase(a: string, b: string): number {
  return cmp(a.toLowerCase(), b.toLowerCase());
}
