import { randomUUID } from "node:crypto";
import { createAuditLog } from "./audit.ts";
import { createCommentService } from "./comments.ts";
import { createHandlers } from "./handlers.ts";
import { createMemoryPersistence } from "./persistence.ts";
import type { Persistence } from "./persistence.ts";
import { createSearchIndex } from "./search.ts";
import { createDocumentService } from "./service.ts";
import { createDocumentStore } from "./store.ts";

export interface AppDeps {
  persistence?: Persistence;
  now?: () => number;
  newId?: () => string;
}

/** Wires the pieces together. Tests pass their own persistence, clock and ids. */
export function createApp(deps: AppDeps = {}) {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => randomUUID().slice(0, 8));
  const persistence = deps.persistence ?? createMemoryPersistence();

  const store = createDocumentStore(persistence);
  const audit = createAuditLog(now);
  const search = createSearchIndex();
  const service = createDocumentService({ store, audit, search, now, newId });
  const comments = createCommentService({ documents: service, now, newId });
  const handlers = createHandlers({ documents: service, comments, audit });

  return { handle: handlers.handle, service, store, audit, search };
}

export type App = ReturnType<typeof createApp>;
