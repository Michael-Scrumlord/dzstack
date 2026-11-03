export type Status = "draft" | "review" | "published";
export const STATUSES: readonly Status[] = ["draft", "review", "published"];

export const EDITABLE_FIELDS = ["title", "body", "status", "tags"] as const;
export type FieldName = (typeof EDITABLE_FIELDS)[number];

export interface EditableFields {
  title: string;
  body: string;
  status: Status;
  tags: string[];
}

export type Role = "owner" | "editor" | "viewer" | "none";

export interface Acl {
  editors: string[];
  viewers: string[];
}

/** What the store keeps and what persistence saves. */
export interface DocumentRecord extends EditableFields {
  id: string;
  ownerId: string;
  /** 1 when created, +1 for every accepted change. */
  version: number;
  createdAt: number;
  updatedAt: number;
  acl: Acl;
}

export interface AuditEntry {
  seq: number;
  at: number;
  actor: string;
  documentId: string;
  /** The version this change produced. */
  version: number;
  action: "create" | "edit" | "share";
  fields?: Partial<EditableFields>;
  share?: { userId: string; role: "editor" | "viewer" };
}

export interface Comment {
  id: string;
  documentId: string;
  author: string;
  text: string;
  createdAt: number;
}
