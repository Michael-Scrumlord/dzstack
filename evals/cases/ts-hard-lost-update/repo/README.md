# docs-service

The backend of our collaborative document editor: documents with a title, a body, a status and tags, edited by several people at once. An in-memory store with asynchronous persistence, a service layer that holds the rules, HTTP-style handlers in front, and an audit log. Tests run with `npm test` (Node 24, no dependencies).

## Layout

| File | What it does |
|---|---|
| `src/handlers.ts` | `handle(request)`: routes, status codes and response bodies. Knows nothing about storage |
| `src/service.ts` | the rules: who may do what, creating, editing and sharing documents |
| `src/store.ts` | `DocumentStore`: the documents in memory, written through to persistence |
| `src/persistence.ts` | the `Persistence` port (`load`, `save`, `list`) and an in-memory stand-in |
| `src/audit.ts` | the audit log |
| `src/validation.ts`, `permissions.ts`, `errors.ts`, `types.ts` | input checks, roles, errors, shared types |
| `src/search.ts`, `comments.ts`, `export.ts`, `stats.ts`, `tags.ts`, `templates.ts` | the features around documents |
| `src/app.ts` | `createApp({ persistence, now, newId })` wires everything; tests pass their own persistence, clock and ids |

`createApp` returns `{ handle, service, store, audit, search }`. A request is `{ method, path, query?, body?, user? }` with `user` as `{ id }`; a response is `{ status, body? }`. Errors answer `{ error, message }` (401 without a user, 400 validation, 403, 404, 409, 503).

## Routes

| Route | Result |
|---|---|
| `POST /documents` `{ title, body?, status?, tags?, template? }` | 201 `{ document }` |
| `GET /documents`, `GET /documents/:id` | 200 `{ documents }` / `{ document }` |
| `PATCH /documents/:id` `{ baseVersion, fields }` | 200 `{ document }`, or 409: see below |
| `POST /documents/:id/share` `{ userId, role }` (owner only; `editor` or `viewer`) | 200 `{ document }` |
| `GET /documents/:id/audit` | 200 `{ entries }` |
| `GET /documents/:id/export?format=md\|txt`, `/stats` | 200 |
| `POST/GET /documents/:id/comments`, `DELETE .../comments/:commentId` | 201 / 200 / 204 |
| `GET /search?q=`, `GET /tags` | 200 |

A document is `{ id, ownerId, title, body, status, tags, version, createdAt, updatedAt }`. `version` is 1 when the document is created and goes up by one with every accepted change (an edit or a share).

## Saving edits

`PATCH /documents/:id` takes `{ baseVersion, fields }`: `baseVersion` is the `version` of the document the person edited (the one they last read), and `fields` is any of `title`, `body`, `status`, `tags`.

- `baseVersion` is a whole number from 0. A missing or malformed one is a 400 `validation`; one greater than the document's current version is a 400 `invalid_base_version`.
- A field that was **changed after `baseVersion`** and now holds a value other than the one this save sets is a **conflict**. Values compare by value: `["a", "b"]` equals `["a", "b"]`.
- A save with a conflict is rejected with 409 `{ error: "conflict", message, currentVersion, conflictingFields, document }`: `currentVersion` is the version now stored, `conflictingFields` lists the conflicting field names in the order title, body, status, tags, and `document` is the current document. Nothing is stored and nothing is logged. The person looks at the current document, then saves again with `baseVersion` set to `currentVersion`; that save is accepted unless somebody got in between again.
- A save without a conflict is **merged** onto the current version, however old `baseVersion` is: its fields are applied to the current document and what other people changed in other fields stays. The result is the next version and a 200 `{ document }` with the merged document.
- A field set to the value it already has is not a change. A save in which no field changes (for instance because somebody else already made the same change) is accepted without creating a version: 200 with the current document, no new version, no audit entry.
- Edits to different documents never wait for each other.

## Sharing

`POST /documents/:id/share` changes who can see or edit a document. It is a change like an edit: it produces the next version and an audit entry, and it must neither lose a concurrent edit nor be lost by one. Two shares at the same time both take effect.

## Audit log

Every accepted change gets exactly one entry and nothing else gets one: `create`, `edit` (only when at least one field changed) and `share`. Entry: `{ seq, at, actor, documentId, version, action, fields?, share? }`. `seq` counts 1, 2, 3 ... over the whole log; `version` is the version the change produced, so one document's entries have consecutive versions. For an edit, `fields` holds only the fields that changed, with their new values. Rejected saves (409), saves that failed and saves that changed nothing leave no entry.

## Persistence and the store

`Persistence` (`src/persistence.ts`) is a port. The real adapter is a plain key-value write in another repository: `save` overwrites whatever is stored under the id, there is no compare-and-swap, no transaction and no locking, calls can be slow, they can finish in any order, and they can fail with `PersistenceError` (503 `storage_unavailable`). Do not add methods to it.

- The store keeps documents in memory once loaded and writes through. A document that is not in memory is loaded on first use; however many requests meet it cold at the same time, they must all end up working on one copy, and a load that arrives late must not replace a newer version.
- A change is accepted only once persistence has stored it. When persistence fails nothing has happened: no new version, no audit entry, no search index update, and a `GET` still returns the previous version. `GET` returns the last accepted version, never one whose save is still in flight or has failed. Persistence must end up holding the same document the service serves.
- Ids and times come from `deps` (`newId()`, `now()`).
