import { ConflictError } from "./errors.ts";
import type { Persistence } from "./persistence.ts";
import type { DocumentRecord } from "./types.ts";

export interface DocumentStore {
  /** The document as last saved, or undefined. Callers get a copy they may change freely. */
  get(id: string): Promise<DocumentRecord | undefined>;
  /** Adds a new document (version 1). ConflictError when the id is taken. */
  insert(record: DocumentRecord): Promise<DocumentRecord>;
  /** Writes the record with the version raised by one, and returns what was written. */
  save(record: DocumentRecord): Promise<DocumentRecord>;
  list(): Promise<DocumentRecord[]>;
}

/** Documents are kept in memory once loaded; persistence is where they survive a restart. */
export function createDocumentStore(persistence: Persistence): DocumentStore {
  const cache = new Map<string, DocumentRecord>();

  async function get(id: string): Promise<DocumentRecord | undefined> {
    const cached = cache.get(id);
    if (cached) return structuredClone(cached);
    const loaded = await persistence.load(id);
    if (!loaded) return undefined;
    cache.set(id, loaded);
    return structuredClone(loaded);
  }

  async function insert(record: DocumentRecord): Promise<DocumentRecord> {
    if (await get(record.id)) throw new ConflictError(`document ${record.id} already exists`);
    const stored = { ...structuredClone(record), version: 1 };
    await persistence.save(stored);
    cache.set(stored.id, stored);
    return structuredClone(stored);
  }

  async function save(record: DocumentRecord): Promise<DocumentRecord> {
    const next = { ...structuredClone(record), version: record.version + 1 };
    await persistence.save(next);
    cache.set(next.id, next);
    return structuredClone(next);
  }

  async function list(): Promise<DocumentRecord[]> {
    const ids = await persistence.list();
    const found = await Promise.all(ids.map((id) => get(id)));
    return found.filter((record): record is DocumentRecord => record !== undefined);
  }

  return { get, insert, save, list };
}
