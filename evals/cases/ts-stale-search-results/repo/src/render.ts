import type { SearchState } from "./search-box.ts";

// Plain-text rendering of the search state, one string per line. The web UI
// maps these onto elements; the text version is what the terminal demo prints.
export function renderSearch(state: SearchState): string[] {
  const lines: string[] = [];
  if (state.error !== null) {
    lines.push(`Search failed: ${state.error}`);
    return lines;
  }
  if (state.loading) lines.push("Searching...");
  if (state.results.length === 0) {
    if (!state.loading && state.query.trim() !== "") lines.push(`No results for "${state.query.trim()}"`);
    return lines;
  }
  state.results.forEach((r, i) => lines.push(`${i + 1}. ${r.title}`));
  return lines;
}
