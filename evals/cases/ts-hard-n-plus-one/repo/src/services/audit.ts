import type { Db } from "../db/types.ts";
import type { Viewer } from "../auth/session.ts";
import { stamp } from "../lib/clock.ts";
import type { Clock } from "../lib/clock.ts";

/** One row in audit_log per change a person makes. Reads are not audited. */
export async function audit(db: Db, clock: Clock, viewer: Viewer, action: string, target: string): Promise<void> {
  await db.insert("audit_log", { org_id: viewer.orgId, user_id: viewer.userId, action, target, at: stamp(clock) });
}
