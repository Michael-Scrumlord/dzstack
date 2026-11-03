// Readable, deterministic ids ("ord_1", "res_7"): one counter per prefix.

export interface IdGenerator {
  next(prefix: string): string;
}

export function createIdGenerator(): IdGenerator {
  const counters = new Map<string, number>();
  return {
    next(prefix) {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}_${n}`;
    },
  };
}
