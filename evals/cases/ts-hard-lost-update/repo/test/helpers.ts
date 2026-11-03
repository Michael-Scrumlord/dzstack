import { createApp } from "../src/app.ts";
import type { App } from "../src/app.ts";
import type { ApiResponse } from "../src/handlers.ts";
import { createMemoryPersistence } from "../src/persistence.ts";

export function makeApp(): App {
  let clock = 1_000_000;
  let counter = 0;
  return createApp({
    persistence: createMemoryPersistence(),
    now: () => ++clock,
    newId: () => `doc${++counter}`,
  });
}

export function as(app: App, user: string | undefined) {
  return (method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<ApiResponse> =>
    app.handle({ method, path, body, query, user: user === undefined ? undefined : { id: user } });
}

export function bodyOf<T = any>(response: ApiResponse): T {
  return response.body as T;
}

/** Creates a document as `owner` and returns its id. */
export async function createDoc(app: App, owner: string, fields: Record<string, unknown> = {}): Promise<string> {
  const response = await as(app, owner)("POST", "/documents", { title: "Plan", body: "Draft", ...fields });
  if (response.status !== 201) throw new Error(`create failed: ${JSON.stringify(response)}`);
  return bodyOf(response).document.id;
}
