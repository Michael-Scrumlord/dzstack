import type { Db } from "../db/types.ts";
import type { ProjectRow } from "../db/schema.ts";
import { isOrgAdmin } from "../auth/session.ts";
import type { Viewer } from "../auth/session.ts";
import * as members from "../repos/members.ts";

/**
 * Who sees a project (inside the viewer's own org; other orgs' projects never show):
 * - org owners and admins see every project;
 * - org members see projects with visibility "org", and "private" ones they belong to;
 * - guests see only the projects they belong to, whatever the visibility.
 * Belonging means having a row in project_members, in any role.
 */
export async function canSeeProject(db: Db, viewer: Viewer, project: ProjectRow): Promise<boolean> {
  if (project.org_id !== viewer.orgId) return false;
  if (isOrgAdmin(viewer)) return true;
  if (viewer.role === "member" && project.visibility === "org") return true;
  return (await members.roleOf(db, project.id, viewer.userId)) !== undefined;
}

/** Org owners/admins, and project owners/admins/editors, may change a project. */
export async function canEditProject(db: Db, viewer: Viewer, project: ProjectRow): Promise<boolean> {
  if (project.org_id !== viewer.orgId) return false;
  if (isOrgAdmin(viewer)) return true;
  const role = await members.roleOf(db, project.id, viewer.userId);
  return role === "owner" || role === "admin" || role === "editor";
}
