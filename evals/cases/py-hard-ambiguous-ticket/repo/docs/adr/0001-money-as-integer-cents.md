# 0001: Money is integer cents

Status: accepted (2025-06)

Every amount in a document, in the computed form and in the store is a whole number of cents (`unit_price_cents: 4900`). Quantities and percentages are decimal **strings** (`"2.5"`, `"7.5"`), never JSON numbers, because a float cannot hold 0.1 or 7.5% exactly and the ledger must reproduce every invoice to the cent.

Fractions of a cent exist only inside a single calculation, as `Decimal`, and leave it through `money.round_cents` (ADR-0002).
