# projects-api

The projects part of our internal tracker: an in-memory store, the rules around it, and the request handler in front. Three layers, each only talking to the one below:

- `src/handlers.ts`: `handleRequest(service, request)` turns a request into a response. It knows about status codes and nothing about storage.
- `src/service.ts`: `createProjectService(repo, deps)` holds the rules: names are trimmed, 1-60 characters, and unique among projects (ignoring case).
- `src/repository.ts`: `createProjectRepository()` keeps projects in memory, in the order they were inserted.

`src/errors.ts` has the errors the service throws (`ValidationError`, `NotFoundError`, `ConflictError`); the handler maps them to 400, 404 and 409 with a body of `{ error, message }`.

## Routes

| Route | Result |
|---|---|
| `POST /projects` with `{ name }` | 201 `{ project }` |
| `GET /projects` | 200 `{ projects }`, in creation order |
| `GET /projects/:id` | 200 `{ project }` |
| `PATCH /projects/:id` with `{ name }` | 200 `{ project }` |
| `DELETE /projects/:id` | 204, and the project is gone |

A request is `{ method, path, query?, body?, user? }` and `user` is `{ id, role }` with `role` either `"admin"` or `"member"`. A response is `{ status, body? }`.

Time and ids come from `deps` (`now()`, `newId()`) so tests can control them.
