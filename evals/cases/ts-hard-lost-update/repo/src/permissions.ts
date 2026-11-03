import { ForbiddenError } from "./errors.ts";
import type { DocumentRecord, Role } from "./types.ts";

export function roleOf(doc: DocumentRecord, userId: string): Role {
  if (doc.ownerId === userId) return "owner";
  if (doc.acl.editors.includes(userId)) return "editor";
  if (doc.acl.viewers.includes(userId)) return "viewer";
  return "none";
}

export function canView(doc: DocumentRecord, userId: string): boolean {
  return roleOf(doc, userId) !== "none";
}

export function assertCanView(doc: DocumentRecord, userId: string): void {
  if (!canView(doc, userId)) throw new ForbiddenError("you do not have access to this document");
}

export function assertCanEdit(doc: DocumentRecord, userId: string): void {
  const role = roleOf(doc, userId);
  if (role !== "owner" && role !== "editor") throw new ForbiddenError("you may not edit this document");
}

export function assertOwner(doc: DocumentRecord, userId: string): void {
  if (doc.ownerId !== userId) throw new ForbiddenError("only the owner may do that");
}
