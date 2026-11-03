import type { AuditLog } from "./audit.ts";
import { NotFoundError } from "./errors.ts";
import { assertCanEdit, assertCanView, assertOwner, canView } from "./permissions.ts";
import type { SearchIndex } from "./search.ts";
import type { DocumentStore } from "./store.ts";
import type { DocumentRecord, EditableFields } from "./types.ts";

export interface ServiceDeps {
  store: DocumentStore;
  audit: AuditLog;
  search: SearchIndex;
  now: () => number;
  newId: () => string;
}

export interface EditInput {
  /** The version the client's edit was made on. */
  baseVersion: number;
  fields: Partial<EditableFields>;
}

export interface DocumentService {
  create(actor: string, input: EditableFields): Promise<DocumentRecord>;
  get(actor: string, id: string): Promise<DocumentRecord>;
  list(actor: string): Promise<DocumentRecord[]>;
  applyEdit(actor: string, id: string, input: EditInput): Promise<DocumentRecord>;
  share(actor: string, id: string, input: { userId: string; role: "editor" | "viewer" }): Promise<DocumentRecord>;
  search(actor: string, text: string): Promise<DocumentRecord[]>;
}

export function createDocumentService(deps: ServiceDeps): DocumentService {
  const { store, audit, search } = deps;

  async function load(id: string): Promise<DocumentRecord> {
    const doc = await store.get(id);
    if (!doc) throw new NotFoundError(`document ${id} not found`);
    return doc;
  }

  async function create(actor: string, input: EditableFields): Promise<DocumentRecord> {
    const at = deps.now();
    const record: DocumentRecord = {
      id: deps.newId(),
      ownerId: actor,
      ...input,
      version: 1,
      createdAt: at,
      updatedAt: at,
      acl: { editors: [], viewers: [] },
    };
    const saved = await store.insert(record);
    audit.record({ actor, documentId: saved.id, version: saved.version, action: "create", fields: { ...input } });
    search.index(saved);
    return saved;
  }

  async function get(actor: string, id: string): Promise<DocumentRecord> {
    const doc = await load(id);
    assertCanView(doc, actor);
    return doc;
  }

  async function list(actor: string): Promise<DocumentRecord[]> {
    const all = await store.list();
    return all.filter((doc) => canView(doc, actor)).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  async function applyEdit(actor: string, id: string, input: EditInput): Promise<DocumentRecord> {
    const doc = await load(id);
    assertCanEdit(doc, actor);
    const next: DocumentRecord = { ...doc, ...input.fields, updatedAt: deps.now() };
    const saved = await store.save(next);
    audit.record({ actor, documentId: id, version: saved.version, action: "edit", fields: input.fields });
    search.index(saved);
    return saved;
  }

  async function share(actor: string, id: string, input: { userId: string; role: "editor" | "viewer" }) {
    const doc = await load(id);
    assertOwner(doc, actor);
    const without = (users: string[]) => users.filter((user) => user !== input.userId);
    const acl = { editors: without(doc.acl.editors), viewers: without(doc.acl.viewers) };
    (input.role === "editor" ? acl.editors : acl.viewers).push(input.userId);
    const saved = await store.save({ ...doc, acl, updatedAt: deps.now() });
    audit.record({ actor, documentId: id, version: saved.version, action: "share", share: input });
    return saved;
  }

  async function searchDocuments(actor: string, text: string): Promise<DocumentRecord[]> {
    const found: DocumentRecord[] = [];
    for (const id of search.query(text)) {
      const doc = await store.get(id);
      if (doc && canView(doc, actor)) found.push(doc);
    }
    return found;
  }

  return { create, get, list, applyEdit, share, search: searchDocuments };
}
