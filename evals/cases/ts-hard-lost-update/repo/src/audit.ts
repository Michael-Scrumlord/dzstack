import type { AuditEntry } from "./types.ts";

export interface AuditLog {
  /** Appends an entry; seq and at are filled in. */
  record(entry: Omit<AuditEntry, "seq" | "at">): AuditEntry;
  /** Entries in the order they were recorded, optionally only one document's. */
  entries(filter?: { documentId?: string }): AuditEntry[];
}

export function createAuditLog(now: () => number): AuditLog {
  const log: AuditEntry[] = [];
  return {
    record(entry) {
      const full: AuditEntry = { ...structuredClone(entry), seq: log.length + 1, at: now() };
      log.push(full);
      return structuredClone(full);
    },
    entries(filter = {}) {
      const wanted = filter.documentId;
      return log.filter((entry) => wanted === undefined || entry.documentId === wanted).map((entry) => structuredClone(entry));
    },
  };
}
