# Architecture notes

## Many instances, many writers

The API runs as several stateless instances behind a load balancer. The import job and the billing sync write to the same database without going through this API. So a request can be served by any instance, and a row can change between two requests no matter who made the change.

Rule: **an instance keeps nothing derived from the database between requests.** No module-level maps, memoised repository calls, listing caches or "recently loaded" tables. A cache here is wrong in a way that only shows up in production: one instance serves old data while the others serve new data, and the bug disappears after a deploy. Speed comes from fewer and wider queries.

(Per-request state, such as values you look up once while building one response, is fine: it dies with the request.)

## Responses are a contract

The web app and the mobile app read these responses. In particular:

- `GET /projects` returns `items`, `page`, `perPage`, `total`, `totalPages`, `hasNext`. Pinned projects come first; ties fall back to the project id, ascending, whichever direction was asked for. A page past the end is `items: []` with the real totals. With no matches `totalPages` is 0.
- A list item's `members` is the first five active members (owners, then admins, editors, viewers; by name within a role, ignoring case); `memberCount` counts all active members. Deactivated accounts are not members as far as the response is concerned.
- `tags` are the project's live (not archived) tags, ordered by label ignoring case; a tag with no colour is shown as `gray`.
- `latestActivity` is the newest event that is not a `view`, with the actor's name: `System` for system events, the account's name even if it is deactivated, `Unknown` for an account that no longer exists.

A change to what an existing request returns, in values, order or paging, is a breaking change for the apps and needs its own ticket.
