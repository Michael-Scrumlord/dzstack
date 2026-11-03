import { NotFoundError } from "./errors.ts";
import type { DocumentService } from "./service.ts";
import type { Comment } from "./types.ts";

export interface CommentService {
  add(actor: string, documentId: string, text: string): Promise<Comment>;
  list(actor: string, documentId: string): Promise<Comment[]>;
  remove(actor: string, documentId: string, commentId: string): Promise<void>;
}

/** Comments live beside the documents, not in them: adding one never changes a document. */
export function createCommentService(deps: {
  documents: DocumentService;
  now: () => number;
  newId: () => string;
}): CommentService {
  const byDocument = new Map<string, Comment[]>();

  async function add(actor: string, documentId: string, text: string) {
    await deps.documents.get(actor, documentId); // throws unless the actor can see the document
    const comment: Comment = { id: deps.newId(), documentId, author: actor, text, createdAt: deps.now() };
    byDocument.set(documentId, [...(byDocument.get(documentId) ?? []), comment]);
    return structuredClone(comment);
  }

  async function list(actor: string, documentId: string) {
    await deps.documents.get(actor, documentId);
    return structuredClone(byDocument.get(documentId) ?? []);
  }

  async function remove(actor: string, documentId: string, commentId: string) {
    await deps.documents.get(actor, documentId);
    const comments = byDocument.get(documentId) ?? [];
    const target = comments.find((comment) => comment.id === commentId);
    if (!target) throw new NotFoundError(`comment ${commentId} not found`);
    if (target.author !== actor) {
      const doc = await deps.documents.get(actor, documentId);
      if (doc.ownerId !== actor) throw new NotFoundError(`comment ${commentId} not found`);
    }
    byDocument.set(documentId, comments.filter((comment) => comment.id !== commentId));
  }

  return { add, list, remove };
}
