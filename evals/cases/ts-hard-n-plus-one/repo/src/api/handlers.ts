import { asObject, ok } from "../lib/http.ts";
import { parseId, parseListQuery } from "../lib/params.ts";
import { notFound } from "../lib/errors.ts";
import * as users from "../repos/users.ts";
import { weeklyDigest } from "../services/digest.ts";
import { getActivityFeed, getProjectDetail } from "../services/project-detail.ts";
import { listProjects } from "../services/project-list.ts";
import * as write from "../services/project-write.ts";
import { tagStats } from "../services/tag-stats.ts";
import type { Router } from "./router.ts";

export function registerRoutes(router: Router): void {
  router.add("GET", "/me", async ({ db, viewer }) => {
    const user = await users.getById(db, viewer.userId);
    if (!user) throw notFound("user");
    return ok({ user: { id: user.id, name: user.name, email: user.email }, org: { id: viewer.orgId, role: viewer.role } });
  });

  router.add("GET", "/projects", async ({ db, viewer, req }) => {
    return ok(await listProjects(db, viewer, parseListQuery(req.query)));
  });

  router.add("GET", "/projects/:id", async ({ db, viewer, params }) => {
    return ok(await getProjectDetail(db, viewer, parseId(params.id, "id")));
  });

  router.add("GET", "/projects/:id/activity", async ({ db, viewer, params, req }) => {
    const limit = Math.min(Number(req.query?.limit ?? 20) || 20, 50);
    return ok(await getActivityFeed(db, viewer, parseId(params.id, "id"), limit, req.query?.before));
  });

  router.add("POST", "/projects", async ({ db, clock, viewer, req }) => {
    return ok({ project: await write.createProject({ db, clock, viewer }, asObject(req.body)) }, 201);
  });

  router.add("PATCH", "/projects/:id", async ({ db, clock, viewer, params, req }) => {
    return ok({ project: await write.patchProject({ db, clock, viewer }, parseId(params.id, "id"), asObject(req.body)) });
  });

  router.add("POST", "/projects/:id/members", async ({ db, clock, viewer, params, req }) => {
    await write.addMember({ db, clock, viewer }, parseId(params.id, "id"), asObject(req.body));
    return ok({ ok: true }, 201);
  });

  router.add("DELETE", "/projects/:id/members/:userId", async ({ db, clock, viewer, params }) => {
    await write.removeMember({ db, clock, viewer }, parseId(params.id, "id"), parseId(params.userId, "userId"));
    return ok({ ok: true });
  });

  router.add("POST", "/projects/:id/tags", async ({ db, clock, viewer, params, req }) => {
    await write.addTag({ db, clock, viewer }, parseId(params.id, "id"), asObject(req.body));
    return ok({ ok: true }, 201);
  });

  router.add("DELETE", "/projects/:id/tags/:tagId", async ({ db, clock, viewer, params }) => {
    await write.removeTag({ db, clock, viewer }, parseId(params.id, "id"), parseId(params.tagId, "tagId"));
    return ok({ ok: true });
  });

  router.add("POST", "/projects/:id/activity", async ({ db, clock, viewer, params, req }) => {
    await write.postActivity({ db, clock, viewer }, parseId(params.id, "id"), asObject(req.body));
    return ok({ ok: true }, 201);
  });

  router.add("GET", "/tags", async ({ db, viewer }) => ok({ tags: await tagStats(db, viewer) }));

  router.add("GET", "/digest", async ({ db, clock, viewer }) => ok(await weeklyDigest(db, clock, viewer)));
}

