import type { Db } from "../db/types.ts";
import * as users from "./users.ts";

export interface ActivityView {
  kind: string;
  at: string;
  actor: string;
}

/** Page views are recorded for analytics only; they are not activity users care about. */
export const NOISE_KIND = "view";

/** Name shown for an event: the system, a known account (active or not), or "Unknown" for a deleted one. */
export async function actorName(db: Db, actorId: number | null): Promise<string> {
  if (actorId === null) return "System";
  const user = await users.getById(db, actorId);
  return user?.name ?? "Unknown";
}

/** The newest event, ignoring noise. Ties on time go to the later id. */
export async function latest(db: Db, projectId: number): Promise<ActivityView | null> {
  const [row] = await db.select("activity", {
    where: { project_id: projectId, kind: { ne: NOISE_KIND } },
    orderBy: [
      { column: "at", dir: "desc" },
      { column: "id", dir: "desc" },
    ],
    limit: 1,
  });
  if (!row) return null;
  return { kind: row.kind, at: row.at, actor: await actorName(db, row.actor_id) };
}

export async function recent(db: Db, projectId: number, limit: number, before?: string): Promise<ActivityView[]> {
  const rows = await db.select("activity", {
    where: { project_id: projectId, kind: { ne: NOISE_KIND }, ...(before ? { at: { lt: before } } : {}) },
    orderBy: [
      { column: "at", dir: "desc" },
      { column: "id", dir: "desc" },
    ],
    limit,
  });
  const out: ActivityView[] = [];
  for (const row of rows) out.push({ kind: row.kind, at: row.at, actor: await actorName(db, row.actor_id) });
  return out;
}

export async function record(db: Db, projectId: number, actorId: number | null, kind: string, at: string): Promise<void> {
  await db.insert("activity", { project_id: projectId, actor_id: actorId, kind, at });
}

/** Events per project since `since`, for the org's projects. */
export async function countsSince(db: Db, orgId: number, since: string): Promise<Map<number, number>> {
  const rows = await db.select("activity", {
    where: {
      at: { gte: since },
      kind: { ne: NOISE_KIND },
      project_id: { inSelect: { table: "projects", column: "id", where: { org_id: orgId } } },
    },
  });
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.project_id, (counts.get(r.project_id) ?? 0) + 1);
  return counts;
}
