import type { Db } from "../db/types.ts";
import type { Viewer } from "../auth/session.ts";
import { cmpNoCase } from "../lib/compare.ts";
import { DEFAULT_COLOR } from "../repos/tags.ts";

export interface TagStat {
  id: number;
  label: string;
  color: string;
  projects: number;
}

/** The org's live tags with the number of projects that carry each. */
export async function tagStats(db: Db, viewer: Viewer): Promise<TagStat[]> {
  const tags = await db.select("tags", { where: { org_id: viewer.orgId, archived: false } });
  const stats: TagStat[] = [];
  for (const tag of tags) {
    const projects = await db.count("project_tags", { tag_id: tag.id });
    stats.push({ id: tag.id, label: tag.label, color: tag.color ?? DEFAULT_COLOR, projects });
  }
  return stats.sort((a, b) => cmpNoCase(a.label, b.label) || a.id - b.id);
}
