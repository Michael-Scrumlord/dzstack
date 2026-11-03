import type { Db } from "../db/types.ts";
import type { Viewer } from "../auth/session.ts";
import type { Clock } from "../lib/clock.ts";
import type { ApiRequest, ApiResponse } from "../lib/http.ts";

export interface Ctx {
  db: Db;
  clock: Clock;
  viewer: Viewer;
  req: ApiRequest;
  params: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<ApiResponse>;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): void {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
  }

  /** The handler for a request and the :params it captured, or undefined for an unknown route. */
  find(method: string, path: string): { handler: Handler; params: Record<string, string> } | undefined {
    const parts = path.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const hit = route.parts.every((p, i) => {
        if (p.startsWith(":")) {
          params[p.slice(1)] = decodeURIComponent(parts[i]);
          return true;
        }
        return p === parts[i];
      });
      if (hit) return { handler: route.handler, params };
    }
    return undefined;
  }
}
