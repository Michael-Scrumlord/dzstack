// The persistence port. The real service talks to a database; this in-memory version keeps the same
// shape: every call is asynchronous and returns copies, so a caller that reads, decides and writes back
// is working from a snapshot that other callers may have changed in the meantime.

export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  list(filter?: (item: T) => boolean): Promise<T[]>;
  delete(id: string): Promise<boolean>;
}

const tick = () => Promise.resolve();

export function createMemoryCollection<T extends { id: string }>(): Collection<T> {
  const rows = new Map<string, T>();
  return {
    async get(id) {
      await tick();
      const row = rows.get(id);
      return row ? structuredClone(row) : undefined;
    },
    async put(item) {
      await tick();
      rows.set(item.id, structuredClone(item));
    },
    async list(filter) {
      await tick();
      const all = [...rows.values()].map((row) => structuredClone(row));
      return filter ? all.filter(filter) : all;
    },
    async delete(id) {
      await tick();
      return rows.delete(id);
    },
  };
}
