# Events and delivery

Orders and reservations publish events (`src/bus/events.ts`); other parts of the service react to them. The bus hands one *job* per subscriber to the transport, which runs it.

## At least once

Delivery is at least once. The transport may run a job again, a long time after the first run or while the first run is still in progress, and jobs for different events can run at the same time and in any order. A handler has to give the right result when it sees the same event twice, and when it runs next to another handler working on the same data.

## Subscribers

| Event | Subscriber | What it does |
|---|---|---|
| `order.cancelled` | `inventory.release-on-cancel` | releases every reservation of the order |
| `reservation.expired` | `inventory.release-on-expiry` | releases that reservation, then marks the order expired |
| `order.confirmed`, `order.cancelled`, `order.expired` | `notify.*` | queues the customer email |
| everything | `audit.log` | writes an audit row |

## Retries

The two inventory handlers call the warehouse system, so they are wrapped in `withRetry` (`src/bus/retry.ts`): up to `config.retry.attempts` attempts, each given `timeoutMs`, with a growing backoff in between.

A promise cannot be cancelled. When an attempt does not answer within `timeoutMs`, the wrapper counts it as failed and starts the next attempt, but the first attempt keeps running: it may finish a minute later, or never. Attempts of one handler can therefore overlap, and an old attempt can complete after a newer one has already done the work.

A hung attempt must never stop a later attempt from finishing the job. That is what the retry is for.

If every attempt fails, the failure goes to the bus's dead letters and the nightly reconcile (see `operations.md`) picks the work up.
