import type { App } from "../src/api/app.ts";
import type { ApiResponse } from "../src/lib/http.ts";

export function client(app: App, token: string) {
  const call = (method: string, path: string, query?: Record<string, string>, body?: unknown): Promise<ApiResponse> =>
    app.handle({ method, path, query, body, headers: { authorization: `Bearer ${token}` } });
  return {
    get: (path: string, query?: Record<string, string>) => call("GET", path, query),
    post: (path: string, body?: unknown) => call("POST", path, undefined, body),
    patch: (path: string, body?: unknown) => call("PATCH", path, undefined, body),
    del: (path: string) => call("DELETE", path),
  };
}

export const FIXED_NOW = () => new Date("2026-03-03T12:00:00Z");
