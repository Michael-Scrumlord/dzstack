# Performance

## Cost model

Production latency is dominated by round trips, then by rows transferred. `FakeDb` adds it up (`db.stats`, documented in `src/db/README.md`):

    simulatedMs = queries * 4 + rowsRead * 0.02

Measure with `npm run profile` or with `db.stats` in a test. A query that does a lot of work inside the database (`inSelect`, `$or`, `distinctOn`, `selectPage`) costs the same one round trip as a trivial one.

## Budgets

For the read endpoints that list things (`GET /projects` and its siblings):

- at most **12 queries per request**, authentication included, whatever the page size and however many projects the org has;
- a page of up to 100 items costs under **150 ms simulated**, even in an org with 1,000 projects. The cost of a page follows the page, not the size of the team.

The same page costs the same whether it is the first or the fortieth.

## Known slow spots

- `GET /projects` issues queries per project for members, tags and latest activity, and rebuilds the whole listing for every page.
- `GET /tags` counts each tag's projects with its own query. Orgs have a few dozen tags, so it is tolerable.
