import type { Db } from "../db/types.ts";
import type { Viewer } from "../auth/session.ts";
import { isOrgAdmin } from "../auth/session.ts";
import { daysAgo } from "../lib/clock.ts";
import type { Clock } from "../lib/clock.ts";
import { forbidden } from "../lib/errors.ts";
import * as activity from "../repos/activity.ts";
import * as projects from "../repos/projects.ts";

export const DIGEST_DAYS = 7;
export const DIGEST_TOP = 10;

export interface DigestEntry {
  id: number;
  name: string;
  events: number;
}

/** The busiest projects of the last week, for org admins. */
export async function weeklyDigest(db: Db, clock: Clock, viewer: Viewer): Promise<{ since: string; busiest: DigestEntry[] }> {
  if (!isOrgAdmin(viewer)) throw forbidden("the digest is for org admins");
  const since = daysAgo(clock, DIGEST_DAYS);
  const counts = await activity.countsSince(db, viewer.orgId, since);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, DIGEST_TOP);
  const busiest: DigestEntry[] = [];
  for (const [id, events] of top) {
    const project = await projects.getById(db, id);
    if (project) busiest.push({ id, name: project.name, events });
  }
  return { since, busiest };
}
