import type { Db } from "../db/types.ts";
import type { TagRow } from "../db/schema.ts";
import { cmp, cmpNoCase } from "../lib/compare.ts";

export interface TagView {
  label: string;
  color: string;
}

export const DEFAULT_COLOR = "gray";

/** By label ignoring case; labels that differ only in case keep code-unit order ("Api" before "api"). */
export function sortTags(tags: TagView[]): TagView[] {
  return tags.sort((a, b) => cmpNoCase(a.label, b.label) || cmp(a.label, b.label));
}

export const toView = (tag: TagRow): TagView => ({ label: tag.label, color: tag.color ?? DEFAULT_COLOR });

/** The project's visible tags: archived tags are retired and never shown. */
export async function listForProject(db: Db, projectId: number): Promise<TagView[]> {
  const links = await db.select("project_tags", { where: { project_id: projectId } });
  const out: TagView[] = [];
  for (const link of links) {
    const [tag] = await db.select("tags", { where: { id: link.tag_id }, limit: 1 });
    if (!tag || tag.archived) continue;
    out.push(toView(tag));
  }
  return sortTags(out);
}

export async function findByLabel(db: Db, orgId: number, label: string): Promise<TagRow | undefined> {
  const wanted = label.toLowerCase();
  const tags = await db.select("tags", { where: { org_id: orgId } });
  return tags.find((t) => t.label.toLowerCase() === wanted);
}

export async function create(db: Db, orgId: number, label: string): Promise<TagRow> {
  return db.insert("tags", { org_id: orgId, label, color: null, archived: false });
}

export async function link(db: Db, projectId: number, tagId: number): Promise<void> {
  const already = await db.count("project_tags", { project_id: projectId, tag_id: tagId });
  if (!already) await db.insert("project_tags", { project_id: projectId, tag_id: tagId });
}

export async function unlink(db: Db, projectId: number, tagId: number): Promise<boolean> {
  return (await db.delete("project_tags", { project_id: projectId, tag_id: tagId })) > 0;
}
