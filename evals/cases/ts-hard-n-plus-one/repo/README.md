# teamboard-api

The API behind Teamboard, a project tracker for teams. This repo is the application layer only: `createApp(db)` turns a request into a response. The HTTP server, the production database client and the deployment live in other repos.

```
src/api/        router, handlers, createApp
src/services/   what each endpoint does (listing, detail, writes, digest, tag stats)
src/repos/      one module per table family; single-row and per-project helpers
src/auth/       session lookup
src/lib/        errors, query parsing, pagination, small helpers
src/db/         the database client's interface and FakeDb, its test double (vendored: read src/db/README.md)
test/           node:test suites      testkit/   shared test data      scripts/   dev tools
docs/           architecture and performance notes
```

## Running

Node 24, no dependencies, no build step.

```
npm test                 # node --test
npm run profile          # what the projects page costs for a generated team of 250 projects
node scripts/profile.ts 600
```

## Endpoints

Every request needs `Authorization: Bearer <token>`; the token names a row in `sessions`, which gives the user, the org and the user's role in it (`owner`, `admin`, `member`, `guest`). Errors are `{ "error": { "code", "message" } }`.

| | |
|---|---|
| `GET /me` | the signed-in user and org role |
| `GET /projects` | the projects the viewer may see, with members, tags and latest activity. Query: `page`, `perPage` (default 20, at most 100), `sort` (`name`, `created`, `updated`), `order`, `q` (name or key contains), `tag` (label), `includeArchived` |
| `GET /projects/:id` | one project with its full member list and recent activity; 404 if the viewer cannot see it |
| `GET /projects/:id/activity` | the activity feed, newest first, paged with `before` |
| `POST /projects`, `PATCH /projects/:id` | create and edit |
| `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` | membership |
| `POST /projects/:id/tags`, `DELETE /projects/:id/tags/:tagId` | tagging |
| `POST /projects/:id/activity` | record a `view`, `comment` or `file_added` event |
| `GET /tags` | the org's live tags with how many projects use each |
| `GET /digest` | the week's busiest projects (org admins) |

The response shapes are a contract with the web app and the mobile app. See `docs/architecture.md` before changing a field, an ordering or a paging rule.

## The database in tests

All code reaches the database through the `Db` interface (`src/db/types.ts`). Tests use `FakeDb`, an in-memory implementation that also counts round trips and rows and turns them into simulated milliseconds, so a page that is slow in production can be measured here without waiting. `src/db/README.md` documents the query language and its limits (for example, an in-list holds at most 200 values, as in production). `src/db/` is vendored from the platform team's package: use what it offers and do not change it here.

Tests that write take a fixed clock: `createApp(db, { now: () => new Date("2026-03-03T12:00:00Z") })`.

## Performance

`docs/performance.md` has the budgets and the cost model.
