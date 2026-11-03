import type { Db } from "../db/types.ts";
import type { Viewer } from "../auth/session.ts";
import { notFound } from "../lib/errors.ts";
import * as activity from "../repos/activity.ts";
import * as members from "../repos/members.ts";
import * as projects from "../repos/projects.ts";
import type { ActivityView } from "../repos/activity.ts";
import { buildItem } from "./project-list.ts";
import type { ProjectListItem } from "./project-item.ts";
import { canSeeProject } from "./permissions.ts";
import type { ProjectRow } from "../db/schema.ts";

export const RECENT_ACTIVITY = 10;

export interface ProjectDetail {
  project: ProjectListItem;
  recentActivity: ActivityView[];
}

/** A project the viewer may not see is reported as missing, so its existence does not leak. */
export async function requireVisible(db: Db, viewer: Viewer, id: number): Promise<ProjectRow> {
  const project = await projects.getById(db, id);
  if (!project || !(await canSeeProject(db, viewer, project))) throw notFound("project");
  return project;
}

/** The list item with the full member list instead of the preview, plus the latest events. */
export async function getProjectDetail(db: Db, viewer: Viewer, id: number): Promise<ProjectDetail> {
  const project = await requireVisible(db, viewer, id);
  const item = await buildItem(db, project);
  const everyone = await members.listActive(db, project.id);
  return {
    project: { ...item, members: everyone },
    recentActivity: await activity.recent(db, project.id, RECENT_ACTIVITY),
  };
}

export async function getActivityFeed(
  db: Db,
  viewer: Viewer,
  id: number,
  limit: number,
  before?: string,
): Promise<{ items: ActivityView[]; next: string | null }> {
  const project = await requireVisible(db, viewer, id);
  const rows = await activity.recent(db, project.id, limit + 1, before);
  const items = rows.slice(0, limit);
  return { items, next: rows.length > limit ? items[items.length - 1].at : null };
}
