import type { DocumentRecord } from "./types.ts";

export interface SearchIndex {
  /** (Re)indexes a document from its current content. */
  index(doc: DocumentRecord): void;
  /** Ids of documents containing every word of the query, in id order. */
  query(text: string): string[];
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function createSearchIndex(): SearchIndex {
  const words = new Map<string, Set<string>>();
  return {
    index(doc) {
      words.set(doc.id, new Set(tokenize(`${doc.title} ${doc.body} ${doc.tags.join(" ")}`)));
    },
    query(text) {
      const wanted = tokenize(text);
      if (wanted.length === 0) return [];
      return [...words.entries()]
        .filter(([, found]) => wanted.every((word) => found.has(word)))
        .map(([id]) => id)
        .sort();
    },
  };
}
