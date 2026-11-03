export function normalizeQuery(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
