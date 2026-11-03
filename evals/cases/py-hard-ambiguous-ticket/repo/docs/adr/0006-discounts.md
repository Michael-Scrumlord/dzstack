# 0006: Discounts

Status: accepted (2026-02-20). Not implemented yet.

## Context

Sales needs discounts on invoices (see `docs/product-notes.md` for what was agreed with finance). This record fixes how the module models and computes them.

## Decision

- The invoice document gets an optional `discounts` list. Each entry has a `label` and a `kind`: `percent` (with a `percent`) or `fixed` (with an `amount_cents`). The exact shapes and limits are in `docs/invoice-format.md`.
- Discounts apply to the invoice as a whole and are worked out per line, because tax is per line (ADR-0003). For every line the order is: line amount, then each discount in the order listed, then the line's net, then tax on the net.
- A **percent** discount takes `round_cents(net x percent / 100)` off each line, where `net` is what the discounts before it left of that line. It is rounded per line (ADR-0002).
- A **fixed** discount takes its amount off the invoice, or whatever is left on the invoice if that is less. It never takes more than is left.
- No line goes below zero and no invoice total goes below zero.
- The computed form reports, per line, `discount_cents` and `net_cents`; per discount, `applied_cents`; for the invoice, `discount_cents`. They agree: the line discounts add up to the invoice's `discount_cents`, which is also the sum of the discounts' `applied_cents`.
- Documents with discounts are validated as strictly as everything else.

## Consequences

- `subtotal_cents` stays the sum of the line amounts, before discounts. `total_cents` is `subtotal_cents - discount_cents + tax_cents`.
- Invoices stored before this change have no discount fields and must keep printing and exporting (ADR-0004).
- The printed and the emailed invoice both show discounts (`docs/rendering.md`).
- The ledger export keeps its columns (ADR-0005).
