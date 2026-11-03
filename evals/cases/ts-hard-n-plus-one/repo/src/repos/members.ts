import type { Db } from "../db/types.ts";
import type { ProjectRole } from "../db/schema.ts";
import { cmpNoCase } from "../lib/compare.ts";
import * as users from "./users.ts";

export interface MemberView {
  id: number;
  name: string;
  role: ProjectRole;
}

export const ROLE_RANK: Record<ProjectRole, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };

/** Owners first, then admins, editors, viewers; within a role by name (any case), then id. */
export function sortMembers(members: MemberView[]): MemberView[] {
  return members.sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || cmpNoCase(a.name, b.name) || a.id - b.id,
  );
}

/** The members whose accounts are still active, in display order. */
export async function listActive(db: Db, projectId: number): Promise<MemberView[]> {
  const rows = await db.select("project_members", { where: { project_id: projectId } });
  const out: MemberView[] = [];
  for (const row of rows) {
    const user = await users.getById(db, row.user_id);
    if (!users.isActive(user)) continue;
    out.push({ id: user.id, name: user.name, role: row.role });
  }
  return sortMembers(out);
}

export async function roleOf(db: Db, projectId: number, userId: number): Promise<ProjectRole | undefined> {
  const [row] = await db.select("project_members", { where: { project_id: projectId, user_id: userId }, limit: 1 });
  return row?.role;
}

export async function add(db: Db, projectId: number, userId: number, role: ProjectRole): Promise<void> {
  const existing = await roleOf(db, projectId, userId);
  if (existing) await db.update("project_members", { project_id: projectId, user_id: userId }, { role });
  else await db.insert("project_members", { project_id: projectId, user_id: userId, role });
}

export async function remove(db: Db, projectId: number, userId: number): Promise<boolean> {
  return (await db.delete("project_members", { project_id: projectId, user_id: userId })) > 0;
}
