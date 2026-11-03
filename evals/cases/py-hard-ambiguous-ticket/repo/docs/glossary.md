# Glossary

**Amount (of a line)**: quantity times unit price, rounded to whole cents. It is the line before any discount. Field `amount_cents`.

**Applied (amount of a discount)**: what a discount actually took off, which is less than what was asked for when the invoice had less left. Field `applied_cents`.

**Cents**: all money is whole cents (ADR-0001). `4900` is $49.00.

**Computed form**: the dict `billing.api.compute` returns, and the content of a stored invoice. Printed and emailed invoices are drawn from it.

**Discount**: a reduction the seller gives on an invoice. Two kinds: a *percent* discount (a share of what is there, such as 10%) and a *fixed* discount (a sum of money, such as $25). A discount has a label that the customer sees.

**Issued invoice / stored invoice**: an invoice that has been given a number and written to the store. It is never changed (ADR-0004).

**Net (of a line)**: the line's amount minus the discounts that landed on that line. Tax is computed on it. Field `net_cents`.

**Round / rounding**: to whole cents, half up, away from zero, with `money.round_cents` (ADR-0002).

**Subtotal (of an invoice)**: the sum of the line amounts, before discounts and before tax. Field `subtotal_cents`.

**Tax code**: `standard`, `reduced` or `exempt`; with the customer's country it gives a line's tax rate.

**Taxable amount**: the sum of the line nets, which is the subtotal minus the discounts. The base for the invoice's tax.

**Total**: the taxable amount plus tax; the amount due. Field `total_cents`.
