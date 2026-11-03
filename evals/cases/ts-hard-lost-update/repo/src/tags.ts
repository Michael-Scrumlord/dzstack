import type { DocumentRecord } from "./types.ts";

export interface TagCount {
  tag: string;
  count: number;
}

/** How many of the given documents carry each tag: most used first, then alphabetical. */
export function tagCounts(docs: DocumentRecord[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const doc of docs) for (const tag of doc.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
