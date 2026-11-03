// A small router: the HTTP server in front of this module turns requests into HttpRequest and back.

export interface HttpRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export type RouteHandler = (req: HttpRequest, params: Record<string, string>) => Promise<HttpResponse>;

interface Route {
  method: string;
  parts: string[];
  handler: RouteHandler;
}

export interface Router {
  add(method: string, pattern: string, handler: RouteHandler): void;
  handle(req: HttpRequest): Promise<HttpResponse>;
}

function split(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

export function createRouter(): Router {
  const routes: Route[] = [];

  function match(route: Route, parts: string[]): Record<string, string> | null {
    if (route.parts.length !== parts.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < parts.length; i++) {
      const want = route.parts[i];
      if (want.startsWith(":")) params[want.slice(1)] = decodeURIComponent(parts[i]);
      else if (want !== parts[i]) return null;
    }
    return params;
  }

  return {
    add(method, pattern, handler) {
      routes.push({ method: method.toUpperCase(), parts: split(pattern), handler });
    },
    async handle(req) {
      const parts = split(req.path);
      let pathMatched = false;
      for (const route of routes) {
        const params = match(route, parts);
        if (!params) continue;
        pathMatched = true;
        if (route.method === req.method.toUpperCase()) return route.handler(req, params);
      }
      return pathMatched ? { status: 405, body: { error: "method_not_allowed" } } : { status: 404, body: { error: "not_found" } };
    },
  };
}
