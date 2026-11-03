# Operations

## Nightly reconcile

`POST /admin/reconcile` (also scheduled for 03:00) runs `src/inventory/reconcile.ts`. It is the safety net for work the event handlers did not finish:

1. active reservations past their expiry (the process was down when the timer was due) are released;
2. active reservations whose order is cancelled, expired or missing (the release event was lost or dead-lettered) are released;
3. the ledger is compared with the reservation table. A SKU whose `reserved` or `sold` differs from what the active and committed reservations add up to is corrected, and the SKU is listed in the report and in a warning in the log.

Releases from reconcile are recorded with the reason `reconcile`.

## The stock report

`GET /stock` (`?format=text` for the table) lists every SKU with flags:

| Flag | Meaning |
|---|---|
| `LOW` | fewer than `lowStockThreshold` units available |
| `OVERSTATED` | `available` is above `onHand`: the shop would sell stock the warehouse does not have |
| `MISMATCH` | `available + reserved + sold` is not `onHand` |

`OVERSTATED` and `MISMATCH` are never a normal state (see `inventory-model.md`). Do not write the difference off by hand; tell the developers which SKU it was and when.

## Configuration

Environment variables, read by `configFromEnv` (`src/config.ts`): `STOCKROOM_RESERVATION_TTL_MS`, `STOCKROOM_RETRY_ATTEMPTS`, `STOCKROOM_RETRY_TIMEOUT_MS`, `STOCKROOM_RETRY_BACKOFF_MS`, `STOCKROOM_LOW_STOCK`, `STOCKROOM_TAX_BP`.
