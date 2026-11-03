import type { Db } from "../db/types.ts";
import type { ProjectRole, Visibility } from "../db/schema.ts";
import type { Viewer } from "../auth/session.ts";
import { isOrgAdmin } from "../auth/session.ts";
import { stamp } from "../lib/clock.ts";
import type { Clock } from "../lib/clock.ts";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.ts";
import { slugify, uniqueKey } from "../lib/slug.ts";
import * as activity from "../repos/activity.ts";
import * as members from "../repos/members.ts";
import * as projects from "../repos/projects.ts";
import * as tags from "../repos/tags.ts";
import * as users from "../repos/users.ts";
import { audit } from "./audit.ts";
import { canEditProject } from "./permissions.ts";
import { buildItem } from "./project-list.ts";
import { requireVisible } from "./project-detail.ts";
import type { ProjectListItem } from "./project-item.ts";

const ROLES: readonly ProjectRole[] = ["owner", "admin", "editor", "viewer"];
const VISIBILITIES: readonly Visibility[] = ["org", "private"];
/** Kinds any viewer may post to a project they can see. */
export const POSTABLE_KINDS = ["view", "comment", "file_added"] as const;

interface Ctx {
  db: Db;
  clock: Clock;
  viewer: Viewer;
}

function text(value: unknown, field: string, max: number, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && value.trim() === "")) throw badRequest(`${field} must be a non-empty string`);
  if (value.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return value;
}

async function editable(ctx: Ctx, id: number) {
  const project = await requireVisible(ctx.db, ctx.viewer, id);
  if (!(await canEditProject(ctx.db, ctx.viewer, project))) throw forbidden("you cannot change this project");
  return project;
}

export async function createProject(ctx: Ctx, body: Record<string, unknown>): Promise<ProjectListItem> {
  if (ctx.viewer.role === "guest") throw forbidden("guests cannot create projects");
  const name = text(body.name, "name", 80, true) as string;
  const description = text(body.description, "description", 500, false) ?? "";
  const visibility = (body.visibility ?? "org") as Visibility;
  if (!VISIBILITIES.includes(visibility)) throw badRequest("visibility must be org or private");
  const taken = await projects.keysInOrg(ctx.db, ctx.viewer.orgId);
  const key = uniqueKey(typeof body.key === "string" && body.key ? body.key : slugify(name) || "project", taken);
  const now = stamp(ctx.clock);
  const project = await projects.insert(ctx.db, {
    org_id: ctx.viewer.orgId,
    key,
    name: name.trim(),
    description,
    visibility,
    pinned: false,
    archived: false,
    created_at: now,
    updated_at: now,
  });
  await members.add(ctx.db, project.id, ctx.viewer.userId, "owner");
  await activity.record(ctx.db, project.id, ctx.viewer.userId, "created", now);
  await audit(ctx.db, ctx.clock, ctx.viewer, "project.create", String(project.id));
  return buildItem(ctx.db, project);
}

export async function patchProject(ctx: Ctx, id: number, body: Record<string, unknown>): Promise<ProjectListItem> {
  const project = await editable(ctx, id);
  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields.name = (text(body.name, "name", 80, true) as string).trim();
  if (body.description !== undefined) fields.description = text(body.description, "description", 500, false);
  for (const flag of ["pinned", "archived"] as const) {
    if (body[flag] === undefined) continue;
    if (typeof body[flag] !== "boolean") throw badRequest(`${flag} must be true or false`);
    if (flag === "pinned" && !isOrgAdmin(ctx.viewer)) throw forbidden("only org admins pin projects");
    fields[flag] = body[flag];
  }
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility as Visibility)) throw badRequest("visibility must be org or private");
    fields.visibility = body.visibility;
  }
  const now = stamp(ctx.clock);
  await projects.patch(ctx.db, id, { ...fields, updated_at: now });
  await activity.record(ctx.db, id, ctx.viewer.userId, fields.archived === true ? "archived" : "updated", now);
  await audit(ctx.db, ctx.clock, ctx.viewer, "project.update", String(id));
  const fresh = await projects.getById(ctx.db, id);
  return buildItem(ctx.db, fresh ?? project);
}

export async function addMember(ctx: Ctx, id: number, body: Record<string, unknown>): Promise<void> {
  await editable(ctx, id);
  const userId = Number(body.userId);
  const role = (body.role ?? "viewer") as ProjectRole;
  if (!Number.isInteger(userId)) throw badRequest("userId must be a number");
  if (!ROLES.includes(role)) throw badRequest(`role must be one of ${ROLES.join(", ")}`);
  const user = await users.getById(ctx.db, userId);
  if (!user) throw notFound("user");
  if (!users.isActive(user)) throw conflict("that account is deactivated");
  await members.add(ctx.db, id, userId, role);
  await activity.record(ctx.db, id, ctx.viewer.userId, "member_added", stamp(ctx.clock));
  await audit(ctx.db, ctx.clock, ctx.viewer, "member.add", `${id}:${userId}`);
}

export async function removeMember(ctx: Ctx, id: number, userId: number): Promise<void> {
  await editable(ctx, id);
  if (!(await members.remove(ctx.db, id, userId))) throw notFound("member");
  await activity.record(ctx.db, id, ctx.viewer.userId, "member_removed", stamp(ctx.clock));
  await audit(ctx.db, ctx.clock, ctx.viewer, "member.remove", `${id}:${userId}`);
}

export async function addTag(ctx: Ctx, id: number, body: Record<string, unknown>): Promise<void> {
  await editable(ctx, id);
  const label = (text(body.label, "label", 32, true) as string).trim();
  const tag = (await tags.findByLabel(ctx.db, ctx.viewer.orgId, label)) ?? (await tags.create(ctx.db, ctx.viewer.orgId, label));
  if (tag.archived) throw conflict("that tag is retired");
  await tags.link(ctx.db, id, tag.id);
  await audit(ctx.db, ctx.clock, ctx.viewer, "tag.add", `${id}:${tag.id}`);
}

export async function removeTag(ctx: Ctx, id: number, tagId: number): Promise<void> {
  await editable(ctx, id);
  if (!(await tags.unlink(ctx.db, id, tagId))) throw notFound("tag");
  await audit(ctx.db, ctx.clock, ctx.viewer, "tag.remove", `${id}:${tagId}`);
}

export async function postActivity(ctx: Ctx, id: number, body: Record<string, unknown>): Promise<void> {
  const project = await requireVisible(ctx.db, ctx.viewer, id);
  const kind = body.kind;
  if (typeof kind !== "string" || !(POSTABLE_KINDS as readonly string[]).includes(kind)) {
    throw badRequest(`kind must be one of ${POSTABLE_KINDS.join(", ")}`);
  }
  await activity.record(ctx.db, project.id, ctx.viewer.userId, kind, stamp(ctx.clock));
}
