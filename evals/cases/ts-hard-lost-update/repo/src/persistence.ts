import type { DocumentRecord } from "./types.ts";

/**
 * Where documents live between restarts. The real adapter (a database client, in another
 * repository) is a plain key-value write: `save` overwrites whatever is stored under the id.
 * There is no compare-and-swap, no transaction and no locking, calls can take a while and
 * they can fail with a PersistenceError.
 */
export interface Persistence {
  load(id: string): Promise<DocumentRecord | undefined>;
  save(record: DocumentRecord): Promise<void>;
  list(): Promise<string[]>;
}

export interface MemoryPersistence extends Persistence {
  dump(): DocumentRecord[];
}

/** An in-memory stand-in that behaves like the adapter: asynchronous, copies in and out. */
export function createMemoryPersistence(options: { latencyMs?: number } = {}): MemoryPersistence {
  const rows = new Map<string, DocumentRecord>();
  const latency = options.latencyMs ?? 0;
  const tick = () => (latency > 0 ? new Promise<void>((resolve) => setTimeout(resolve, latency)) : Promise.resolve());

  return {
    async load(id) {
      await tick();
      const row = rows.get(id);
      return row ? structuredClone(row) : undefined;
    },
    async save(record) {
      await tick();
      rows.set(record.id, structuredClone(record));
    },
    async list() {
      await tick();
      return [...rows.keys()];
    },
    dump() {
      return [...rows.values()].map((row) => structuredClone(row));
    },
  };
}
