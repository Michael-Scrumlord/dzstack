import type { Db } from "../db/types.ts";
import type { ProjectRow } from "../db/schema.ts";
import type { Viewer } from "../auth/session.ts";
import { cmp, cmpNoCase } from "../lib/compare.ts";
import { paginate } from "../lib/paginate.ts";
import type { PageMeta } from "../lib/paginate.ts";
import type { ListQuery } from "../lib/params.ts";
import * as activity from "../repos/activity.ts";
import * as members from "../repos/members.ts";
import * as projects from "../repos/projects.ts";
import * as tags from "../repos/tags.ts";
import { canSeeProject } from "./permissions.ts";
import { toListItem } from "./project-item.ts";
import type { ProjectListItem } from "./project-item.ts";

export type ProjectListResponse = { items: ProjectListItem[] } & PageMeta;

export async function buildItem(db: Db, project: ProjectRow): Promise<ProjectListItem> {
  const projectMembers = await members.listActive(db, project.id);
  const projectTags = await tags.listForProject(db, project.id);
  const latest = await activity.latest(db, project.id);
  return toListItem(project, projectMembers, projectTags, latest);
}

function matches(item: ProjectListItem, query: ListQuery): boolean {
  if (query.q) {
    const needle = query.q.toLowerCase();
    if (!item.name.toLowerCase().includes(needle) && !item.key.toLowerCase().includes(needle)) return false;
  }
  if (query.tag) {
    const wanted = query.tag.toLowerCase();
    if (!item.tags.some((t) => t.label.toLowerCase() === wanted)) return false;
  }
  return true;
}

/** Pinned projects always come first. Ties fall back to id, ascending, in both directions. */
function comparator(query: ListQuery): (a: ProjectListItem, b: ProjectListItem) => number {
  const dir = query.order === "desc" ? -1 : 1;
  return (a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const c =
      query.sort === "name"
        ? cmpNoCase(a.name, b.name)
        : query.sort === "created"
          ? cmp(a.createdAt, b.createdAt)
          : cmp(a.updatedAt, b.updatedAt);
    return c * dir || a.id - b.id;
  };
}

export async function listProjects(db: Db, viewer: Viewer, query: ListQuery): Promise<ProjectListResponse> {
  const all = await projects.listByOrg(db, viewer.orgId);
  const items: ProjectListItem[] = [];
  for (const project of all) {
    if (project.archived && !query.includeArchived) continue;
    if (!(await canSeeProject(db, viewer, project))) continue;
    items.push(await buildItem(db, project));
  }
  const shown = items.filter((item) => matches(item, query)).sort(comparator(query));
  return paginate(shown, query.page, query.perPage);
}
