import type { AuditLog } from "./audit.ts";
import type { CommentService } from "./comments.ts";
import { AppError, NotFoundError, UnauthorizedError } from "./errors.ts";
import { exportDocument, parseFormat } from "./export.ts";
import { assertCanView } from "./permissions.ts";
import type { DocumentService } from "./service.ts";
import { statsOf } from "./stats.ts";
import { tagCounts } from "./tags.ts";
import { applyTemplate } from "./templates.ts";
import type { DocumentRecord } from "./types.ts";
import { parseComment, parseCreate, parseEdit, parseShare } from "./validation.ts";

export interface ApiRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  user?: { id: string };
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface HandlerDeps {
  documents: DocumentService;
  comments: CommentService;
  audit: AuditLog;
}

/** A document as clients see it: no access list, nothing internal. */
export function present(doc: DocumentRecord) {
  return {
    id: doc.id,
    ownerId: doc.ownerId,
    title: doc.title,
    body: doc.body,
    status: doc.status,
    tags: [...doc.tags],
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function errorResponse(error: unknown): ApiResponse {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  return { status: 500, body: { error: "internal", message: "something went wrong" } };
}

export function createHandlers(deps: HandlerDeps) {
  const { documents, comments, audit } = deps;

  async function route(req: ApiRequest): Promise<ApiResponse> {
    const user = req.user?.id;
    if (!user) throw new UnauthorizedError();
    const parts = req.path.split("/").filter((part) => part !== "");
    const method = req.method.toUpperCase();

    if (parts[0] === "search" && parts.length === 1 && method === "GET") {
      const found = await documents.search(user, req.query?.q ?? "");
      return { status: 200, body: { results: found.map((doc) => ({ id: doc.id, title: doc.title })) } };
    }
    if (parts[0] === "tags" && parts.length === 1 && method === "GET") {
      return { status: 200, body: { tags: tagCounts(await documents.list(user)) } };
    }
    if (parts[0] !== "documents") throw new NotFoundError(`no route for ${method} ${req.path}`);

    if (parts.length === 1) {
      if (method === "POST") {
        const raw = (req.body ?? {}) as Record<string, unknown>;
        const input = applyTemplate(raw.template, parseCreate(req.body), { body: raw.body !== undefined });
        const doc = await documents.create(user, input);
        return { status: 201, body: { document: present(doc) } };
      }
      if (method === "GET") {
        const docs = await documents.list(user);
        return { status: 200, body: { documents: docs.map(present) } };
      }
    }

    const id = parts[1];
    if (id === undefined) throw new NotFoundError(`no route for ${method} ${req.path}`);

    if (parts.length === 2) {
      if (method === "GET") return { status: 200, body: { document: present(await documents.get(user, id)) } };
      if (method === "PATCH") {
        const saved = await documents.applyEdit(user, id, parseEdit(req.body));
        return { status: 200, body: { document: present(saved) } };
      }
    }

    if (parts.length === 3) {
      const sub = parts[2];
      if (sub === "share" && method === "POST") {
        const saved = await documents.share(user, id, parseShare(req.body));
        return { status: 200, body: { document: present(saved) } };
      }
      if (sub === "export" && method === "GET") {
        const format = parseFormat(req.query?.format);
        const doc = await documents.get(user, id);
        return { status: 200, body: { format, content: exportDocument(doc, format) } };
      }
      if (sub === "stats" && method === "GET") {
        return { status: 200, body: { stats: statsOf(await documents.get(user, id)) } };
      }
      if (sub === "audit" && method === "GET") {
        assertCanView(await documents.get(user, id), user);
        return { status: 200, body: { entries: audit.entries({ documentId: id }) } };
      }
      if (sub === "comments" && method === "POST") {
        const comment = await comments.add(user, id, parseComment(req.body).text);
        return { status: 201, body: { comment } };
      }
      if (sub === "comments" && method === "GET") {
        return { status: 200, body: { comments: await comments.list(user, id) } };
      }
    }

    if (parts.length === 4 && parts[2] === "comments" && method === "DELETE") {
      await comments.remove(user, id, parts[3] as string);
      return { status: 204 };
    }

    throw new NotFoundError(`no route for ${method} ${req.path}`);
  }

  async function handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      return await route(req);
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { handle };
}
