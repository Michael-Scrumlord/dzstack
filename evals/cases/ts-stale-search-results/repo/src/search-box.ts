import { createStore } from "./store.ts";
import { describeError, normalizeQuery } from "./query.ts";

export interface SearchResult {
  id: string;
  title: string;
}

export type FetchResults = (query: string) => Promise<SearchResult[]>;

export interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

export interface SearchBoxOptions {
  minLength?: number;
}

export interface SearchBox {
  setQuery(text: string): void;
  getState(): SearchState;
  subscribe(listener: (state: SearchState) => void): () => void;
}

export function createSearchBox(fetchResults: FetchResults, options: SearchBoxOptions = {}): SearchBox {
  const minLength = options.minLength ?? 2;
  const store = createStore<SearchState>({ query: "", results: [], loading: false, error: null });

  function setQuery(text: string): void {
    const query = normalizeQuery(text);
    if (query.length < minLength) {
      store.set({ query: text, results: [], loading: false, error: null });
      return;
    }
    store.set({ query: text, loading: true, error: null });
    fetchResults(query).then(
      (results) => {
        store.set({ results, loading: false });
      },
      (err) => {
        store.set({ results: [], loading: false, error: describeError(err) });
      },
    );
  }

  return {
    setQuery,
    getState() {
      const s = store.get();
      return { ...s, results: [...s.results] };
    },
    subscribe: store.subscribe,
  };
}
