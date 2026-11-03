# The invoice document and the computed form

## Input: the document

A JSON object. Unknown fields are rejected (a typo must not silently drop data). Amounts are whole cents; quantities and percentages are decimal **strings** (ADR-0001).

| field | |
|---|---|
| `number` | optional string; the store assigns the real number when an invoice is issued |
| `customer` | object: `name` (required), `country` (required, two upper-case letters), `email` (optional) |
| `currency` | `USD` (default), `EUR` or `GBP` |
| `issued` | required date, `2026-03-02` |
| `terms_days` | whole number of days to pay, default 30 |
| `notes` | optional text, at most 500 characters |
| `lines` | required, 1 to 200 entries |
| `discounts` | optional list, at most 5 entries (see below) |

A line: `sku` (required), `description`, `quantity` (required decimal string greater than zero), `unit_price_cents` (required whole number, 0 or more), `tax_code` (`standard` default, `reduced`, `exempt`).

### Discounts

```json
"discounts": [
  {"label": "Loyalty", "kind": "percent", "percent": "10"},
  {"label": "First month", "kind": "fixed", "amount_cents": 2500}
]
```

- `label`: required, a non-empty string of at most 60 characters.
- `kind`: `percent` or `fixed`.
- `percent` (kind `percent` only, required): a decimal string greater than 0 and at most 100, such as `"10"` or `"7.5"`. A JSON number is an error, as for quantities.
- `amount_cents` (kind `fixed` only, required): a whole number of cents greater than 0.
- A `percent` entry must not carry `amount_cents` and a `fixed` entry must not carry `percent`; any other field is unknown.
- More than 5 entries, or a list that is not a list, is an error.

All errors are `DocumentError`s with a message that names the field.

## Output: the computed form

`billing.api.compute(doc)` returns, and the store keeps (plus `format_version`):

| field | |
|---|---|
| `number`, `customer`, `currency`, `issued`, `terms_days`, `notes` | as in the document (`number` may be `null`) |
| `lines` | one entry per line: `sku`, `description`, `quantity`, `unit_price_cents`, `tax_code`, `amount_cents`, `discount_cents`, `net_cents`, `tax_cents` |
| `discounts` | one entry per discount, in order: `label`, `kind`, `percent` or `amount_cents` as given, and `applied_cents` |
| `subtotal_cents` | sum of the line amounts, before discounts |
| `discount_cents` | sum of everything the discounts took off |
| `tax_cents` | sum of the line taxes |
| `total_cents` | `subtotal_cents - discount_cents + tax_cents` |

`discounts` (an empty list), `discount_cents` (0) and the lines' `discount_cents` (0) and `net_cents` (equal to `amount_cents`) are always present, also on an invoice without discounts. Files stored before discounts existed do not have them (ADR-0004).

Invariants: for every line, `net_cents = amount_cents - discount_cents`, `0 <= discount_cents <= amount_cents`, and `tax_cents` is the tax on `net_cents`. The line discounts add up to `discount_cents`, which is also the sum of the `applied_cents`.
