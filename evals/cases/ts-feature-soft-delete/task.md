We need soft delete for projects. Deleting one throws it away for good today, and support has had two "I deleted the wrong one" requests this month. Here's what we agreed on; please build it and leave everything else behaving as it does now. Tests run with `npm test`.

**Data.** A project gets `deletedAt: number | null`: the service clock's `now()` at the moment it was deleted, `null` while it is live. New projects start with `deletedAt: null`.

**Repository** (`src/repository.ts`)
- `findById(id, options?)` and `findAll(options?)` skip deleted projects unless `options.includeDeleted` is `true`. `findAll` keeps its insertion order, deleted ones included.
- `insert`, `update` and `remove` behave as before, and `update` and `remove` also work on deleted projects.

**Service** (`src/service.ts`)
- `delete(id)` marks the project deleted at `now()` and returns nothing. An unknown id, or one that is already deleted, throws `NotFoundError`.
- Everywhere else a deleted project counts as missing: `get(id)` and `rename(id, name)` throw `NotFoundError` for it, and `list()` leaves it out.
- `list(options?)`: with `{ includeDeleted: true }` it returns deleted projects too, in creation order (a deleted project stays where it was in the list).
- A deleted project no longer holds its name: creating or renaming another project to that name works.
- `restore(id)` clears `deletedAt` and returns the project. It is allowed while `now() - deletedAt <= 30 * 24 * 60 * 60 * 1000`, so exactly 30 days is still fine and one millisecond later is too late. It checks these in this order and stops at the first that applies: an unknown id throws `NotFoundError`; a project that isn't deleted throws `ConflictError`; one past the 30 days throws a new `RestoreExpiredError` (export it from `src/errors.ts`); one whose name a live project now has (names compare ignoring case, as usual) throws `ConflictError`. A failed restore changes nothing, and the project stays deleted. If a project is deleted again after a restore, the 30 days count from the new deletion.

**Handlers** (`src/handlers.ts`)
- `DELETE /projects/:id` is still a 204. After that `GET /projects/:id` and `PATCH /projects/:id` are 404, it's gone from `GET /projects`, and a second `DELETE` is a 404.
- `POST /projects/:id/restore` answers 200 `{ project }` (with `deletedAt: null`). Errors use the same `{ error, message }` body as the others: 404 `not_found`, 409 `conflict`, and 410 `restore_expired` for `RestoreExpiredError`.
- `GET /projects?includeDeleted=true` lists deleted projects too (each project carries its `deletedAt`), but only when `request.user?.role === "admin"`. Anyone else, including a request with no user, gets 403 `{ error: "forbidden", message }`. Without that query parameter, or with `includeDeleted=false`, the list hides deleted projects for everybody.
