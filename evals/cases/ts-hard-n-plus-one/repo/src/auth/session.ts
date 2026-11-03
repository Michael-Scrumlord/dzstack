import type { Db } from "../db/types.ts";
import type { OrgRole } from "../db/schema.ts";
import { bearerToken } from "../lib/http.ts";
import type { ApiRequest } from "../lib/http.ts";
import { unauthorized } from "../lib/errors.ts";

export interface Viewer {
  userId: number;
  orgId: number;
  role: OrgRole;
}

/** Look the request's bearer token up in `sessions`: one query. */
export async function authenticate(db: Db, req: ApiRequest): Promise<Viewer> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  const [session] = await db.select("sessions", { where: { token }, limit: 1 });
  if (!session) throw unauthorized();
  return { userId: session.user_id, orgId: session.org_id, role: session.role };
}

export const isOrgAdmin = (viewer: Viewer) => viewer.role === "owner" || viewer.role === "admin";
