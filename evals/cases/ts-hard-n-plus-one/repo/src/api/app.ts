import type { Db } from "../db/types.ts";
import { authenticate } from "../auth/session.ts";
import { systemClock } from "../lib/clock.ts";
import type { Clock } from "../lib/clock.ts";
import { HttpError, notFound } from "../lib/errors.ts";
import { errorBody } from "../lib/http.ts";
import type { ApiRequest, ApiResponse } from "../lib/http.ts";
import { registerRoutes } from "./handlers.ts";
import { Router } from "./router.ts";

export interface AppOptions {
  /** Where "now" comes from; tests pass a fixed clock. */
  now?: Clock;
}

export interface App {
  handle(req: ApiRequest): Promise<ApiResponse>;
}

/**
 * The whole API as one function: request in, response out. An HTTP server (not in this
 * repo) calls `handle` for every request, on any of several instances. HttpErrors become
 * error responses; anything else is a bug and propagates.
 */
export function createApp(db: Db, options: AppOptions = {}): App {
  const clock = options.now ?? systemClock;
  const router = new Router();
  registerRoutes(router);

  return {
    async handle(req) {
      try {
        const viewer = await authenticate(db, req);
        const route = router.find(req.method, req.path);
        if (!route) throw notFound("route");
        return await route.handler({ db, clock, viewer, req, params: route.params });
      } catch (err) {
        if (err instanceof HttpError) return { status: err.status, body: errorBody(err.code, err.message) };
        throw err;
      }
    },
  };
}
