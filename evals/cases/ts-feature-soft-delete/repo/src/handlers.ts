import { ConflictError, NotFoundError, ValidationError } from "./errors.ts";
import type { ProjectService } from "./service.ts";

export interface ApiUser {
  id: string;
  role: "admin" | "member";
}

export interface ApiRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  user?: ApiUser;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

function readBody(req: ApiRequest): Record<string, unknown> {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    throw new ValidationError("request body must be a JSON object");
  }
  return req.body as Record<string, unknown>;
}

function route(service: ProjectService, req: ApiRequest): ApiResponse {
  const parts = req.path.split("/").filter((part) => part !== "");
  if (parts[0] === "projects") {
    if (parts.length === 1) {
      if (req.method === "GET") return { status: 200, body: { projects: service.list() } };
      if (req.method === "POST") return { status: 201, body: { project: service.create({ name: readBody(req).name }) } };
    } else if (parts.length === 2) {
      const id = parts[1];
      if (req.method === "GET") return { status: 200, body: { project: service.get(id) } };
      if (req.method === "PATCH") return { status: 200, body: { project: service.rename(id, readBody(req).name) } };
      if (req.method === "DELETE") {
        service.delete(id);
        return { status: 204 };
      }
    }
  }
  throw new NotFoundError("no such route");
}

function errorResponse(err: unknown): ApiResponse {
  if (err instanceof ValidationError) return { status: 400, body: { error: "validation_failed", message: err.message } };
  if (err instanceof NotFoundError) return { status: 404, body: { error: "not_found", message: err.message } };
  if (err instanceof ConflictError) return { status: 409, body: { error: "conflict", message: err.message } };
  throw err;
}

export function handleRequest(service: ProjectService, req: ApiRequest): ApiResponse {
  try {
    return route(service, req);
  } catch (err) {
    return errorResponse(err);
  }
}
