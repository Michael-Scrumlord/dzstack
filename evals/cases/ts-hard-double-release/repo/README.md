# stockroom

The stock and reservation service behind the shop. It keeps the stock counters per SKU, holds stock for orders that are not paid yet, gives it back when an order is cancelled or the hold runs out, and reconciles everything once a night.

Node 24, TypeScript run directly (imports use `.ts` extensions), no dependencies. Tests: `npm test`.

## Layout

| Folder | What it holds |
|---|---|
| `src/app.ts` | `createApp(deps)`: wires everything together. Clock, transport, warehouse, store, logger and config can all be replaced. |
| `src/inventory/` | the stock `ledger`, the `reservations` service, the event handlers that release stock, the nightly `reconcile` job, the `warehouse` port |
| `src/orders/` | placing, confirming, cancelling and expiring orders |
| `src/bus/` | the event bus, its `transport` port and the `retry` wrapper |
| `src/store/` | the persistence port (an in-memory implementation here) |
| `src/catalog/` | SKUs, prices, tax |
| `src/notify/`, `src/audit/` | customer emails and the audit log, both fed by events |
| `src/reports/` | the stock report ops reads |
| `src/api/` | the routes the HTTP server mounts |
| `src/platform/` | clock, ids, logger, errors |
| `docs/` | `inventory-model.md` (counters and reservation life cycle), `events.md` (delivery and retries), `operations.md` (reconcile and the stock report) |

## Using it

```ts
const app = createApp({ clock, transport, warehouse });   // all optional
app.catalog.add({ sku: "WID-1", name: "Widget", priceCents: 1000, taxClass: "standard" });
app.ledger.receive("WID-1", 40);

const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] });
await app.orders.confirm(order.id);      // or app.orders.cancel(order.id)
app.ledger.snapshot("WID-1");            // { sku, onHand, available, reserved, sold }
```

Everything that talks to the outside world is a port you pass in: `Clock` (`src/platform/clock.ts`), `Transport` (`src/bus/transport.ts`), `WarehousePort` (`src/inventory/warehouse.ts`) and `Store` (`src/store/`). The tests use a manual clock and a manual transport (`test/helpers.ts`), so they decide when a timer fires and when an event is delivered.

Read `docs/` before changing how stock moves.
