import type { Db } from "../db/types.ts";
import type { ProjectRow } from "../db/schema.ts";

export async function listByOrg(db: Db, orgId: number): Promise<ProjectRow[]> {
  return db.select("projects", { where: { org_id: orgId }, orderBy: [{ column: "id" }] });
}

export async function getById(db: Db, id: number): Promise<ProjectRow | undefined> {
  const [project] = await db.select("projects", { where: { id }, limit: 1 });
  return project;
}

export async function keysInOrg(db: Db, orgId: number): Promise<Set<string>> {
  const rows = await db.select("projects", { where: { org_id: orgId } });
  return new Set(rows.map((p) => p.key));
}

export async function insert(db: Db, row: Omit<ProjectRow, "id">): Promise<ProjectRow> {
  return db.insert("projects", row);
}

export async function patch(db: Db, id: number, fields: Partial<Omit<ProjectRow, "id">>): Promise<void> {
  await db.update("projects", { id }, fields);
}
