// Row types for every table. Column names are snake_case, as in the production schema.
// Timestamps are ISO-8601 strings in UTC ("2026-03-02T02:00:00Z"), so they sort as text.

export type OrgRole = "owner" | "admin" | "member" | "guest";
export type ProjectRole = "owner" | "admin" | "editor" | "viewer";
export type Visibility = "org" | "private";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  /** Set when the account was deactivated; such users no longer show up as members. */
  deactivated_at: string | null;
}

export interface SessionRow {
  id: number;
  token: string;
  user_id: number;
  org_id: number;
  /** The user's role in `org_id`, fixed when the session was created. */
  role: OrgRole;
}

export interface ProjectRow {
  id: number;
  org_id: number;
  /** Short unique code such as "PAY" or "web-redesign". */
  key: string;
  name: string;
  description: string;
  visibility: Visibility;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberRow {
  id: number;
  project_id: number;
  user_id: number;
  role: ProjectRole;
}

export interface TagRow {
  id: number;
  org_id: number;
  label: string;
  /** null means "use the default colour". */
  color: string | null;
  archived: boolean;
}

export interface ProjectTagRow {
  id: number;
  project_id: number;
  tag_id: number;
}

export interface ActivityRow {
  id: number;
  project_id: number;
  /** null for events the system produced itself. */
  actor_id: number | null;
  kind: string;
  at: string;
}

export interface AuditRow {
  id: number;
  org_id: number;
  user_id: number;
  action: string;
  target: string;
  at: string;
}

export interface Tables {
  users: UserRow;
  sessions: SessionRow;
  projects: ProjectRow;
  project_members: ProjectMemberRow;
  tags: TagRow;
  project_tags: ProjectTagRow;
  activity: ActivityRow;
  audit_log: AuditRow;
}

export type TableName = keyof Tables;
