export interface ApiRequest {
  method: string;
  /** Path without the query string, e.g. "/projects/12". */
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export const ok = (body: unknown, status = 200): ApiResponse => ({ status, body });

export function errorBody(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

export function bearerToken(req: ApiRequest): string | undefined {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return match?.[1];
}

export function asObject(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
