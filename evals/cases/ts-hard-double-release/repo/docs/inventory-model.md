# Inventory model

## The counters

For every SKU the ledger keeps four numbers:

| Counter | Meaning |
|---|---|
| `onHand` | units physically in the warehouse |
| `available` | units that can still be reserved |
| `reserved` | units held by reservations that are still `active` |
| `sold` | units of confirmed orders (reservations that are `committed`) |

These hold at every moment, not only once the dust has settled:

- `available + reserved + sold = onHand`, and none of them is negative;
- `reserved` is the sum of the quantities of the `active` reservations of that SKU;
- `sold` is the sum of the quantities of the `committed` reservations of that SKU.

`onHand` only changes when stock is received or written off. Placing, cancelling, confirming and expiring orders move units between the other three.

## Reservations

An order holds stock through one reservation per line.

```
            order paid
 active ───────────────▶ committed
   │
   │  order cancelled, hold expired, or reconcile
   ▼
 released
```

- `committed` and `released` are final.
- A reservation gives its units back to `available` **exactly once**, and only if it was never committed. Releasing a reservation that is already released (or committed) does nothing.
- A released reservation can no longer be confirmed: confirming its order fails with `reservation_expired`.
- A reservation expires `reservationTtlMs` after it was made (15 minutes by default). Its timer is cleared when the reservation is committed or released.
- Cancelling an order gives its stock back straight away. It does not wait for the hold to expire.

## Orders

```
 pending ──▶ confirmed
    ├──────▶ cancelled
    └──────▶ expired
```

Cancelling a cancelled order is a no-op that returns the order. Cancelling a confirmed or expired order fails with `invalid_transition`. When one reservation of a pending order expires, the order becomes `expired`; an order in any other state is left alone.

## The warehouse system

Releasing a reservation also tells the warehouse management system (`WarehousePort.deallocate`). That system is slow on a bad day, and sometimes accepts a call and never answers. It treats a repeated `deallocate` for the same reservation id as a no-op, so the call is safe to repeat. A release is complete when the warehouse has been told and the ledger has been updated.
