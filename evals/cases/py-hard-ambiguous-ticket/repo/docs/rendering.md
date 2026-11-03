# The printed and the emailed invoice

Both are drawn from the computed form (or a stored invoice), never from the document, so a reprint never recomputes.

## Printed (text, 72 columns)

```
INVOICE 2026-0042                                      Issued 2026-03-02
Acme GmbH (DE)

SKU        Description                     Qty   Unit price       Amount
------------------------------------------------------------------------
SUB-PRO    Pro plan, March                   1       $49.00       $49.00
------------------------------------------------------------------------
                                    Subtotal                      $49.00
                                    Tax                            $9.31
                                    TOTAL                         $58.31

Payment due within 30 days of the invoice date.
```

Amounts are written with `money.format_cents` (a negative amount is `-$12.34`). Text longer than its column is cut with an ellipsis (`layout.fit`).

### Discounts

Each discount is its own row of the totals block, after `Subtotal` and before `Tax`, in the order of the document: `Discount (<label>)`, with the amount **negative**. With a 10% "Loyalty" discount on the invoice above:

```
                                    Subtotal                      $49.00
                                    Discount (Loyalty)            -$4.90
                                    Tax                            $8.38
                                    TOTAL                         $52.48
```

The `Subtotal` row keeps showing the amount before discounts.

## Emailed (HTML)

A table; the totals sit in `<tfoot>` as `<tr class="subtotal">`, `<tr class="tax">` and `<tr class="total">`. Every piece of text that comes from the document is escaped (`html.escape`). Each discount is a `<tr class="discount">` between the subtotal row and the tax row, with the label `Discount (<label>)` in the `<th colspan="4">` cell and the negative amount in the `<td class="num">` cell.

## Invoices without discounts

They print **exactly** as before, byte for byte, in both formats. Customers diff our invoices month to month.
