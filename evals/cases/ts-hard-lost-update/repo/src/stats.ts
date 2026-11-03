import type { DocumentRecord } from "./types.ts";

export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  headings: string[];
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

/** Lines starting with one to six # characters, without the markers. */
export function headingsOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^#{1,6}\s+(.*\S)\s*$/.exec(line)?.[1])
    .filter((heading): heading is string => heading !== undefined);
}

export function statsOf(doc: DocumentRecord): DocumentStats {
  const words = countWords(doc.body);
  return {
    words,
    characters: doc.body.length,
    lines: doc.body === "" ? 0 : doc.body.split("\n").length,
    headings: headingsOf(doc.body),
    readingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
  };
}
