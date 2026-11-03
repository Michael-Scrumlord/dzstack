import type { Db } from "../db/types.ts";
import type { UserRow } from "../db/schema.ts";

export async function getById(db: Db, id: number): Promise<UserRow | undefined> {
  const [user] = await db.select("users", { where: { id }, limit: 1 });
  return user;
}

/**
 * Several users in one query. `ids` must stay under the driver's in-list limit
 * (MAX_IN_LIST in src/db/fake.ts); the callers so far pass a few dozen.
 */
export async function getByIds(db: Db, ids: readonly number[]): Promise<Map<number, UserRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db.select("users", { where: { id: { in: unique } } });
  return new Map(rows.map((u) => [u.id, u]));
}

export const isActive = (user: UserRow | undefined): user is UserRow => user !== undefined && user.deactivated_at === null;
