# Discounts: product notes (February 2026)

From Priya (product), after the call with sales and finance on 2026-02-12.

## Why

Sales gives discounts all the time and today enters them by hand on a copy of the invoice. Customers have found mistakes, and finance wants the invoice to show exactly what happened.

## What sales sells

- A **percentage** off: "10% loyalty discount", "15% launch partner".
- An **amount** off: "$25 off your first month", a $40 goodwill credit.

Sales stacks them: a loyalty percentage and a promo amount on the same invoice. Up to five per invoice, which is how many lines the printed template has room for.

## What we agreed

1. Discounts come off **before tax**. A customer is taxed on what they actually pay for.
2. Discounts apply in the order they are listed, each to what the earlier ones left. 10% and then another 10% takes 19% off, not 20%.
3. Rounding is the usual rounding, to whole cents, line by line (ADR-0002). We do not round a discount once for the whole invoice.
4. **Never below zero.** A discount cannot take a line under $0.00 and an invoice never totals less than $0.00. An amount-off discount that is bigger than what is left to pay takes what is left and no more. We do not turn discounts into credit.
5. An amount-off discount takes **exactly its amount** off the invoice, to the cent (or everything that is left, see 4). $25 off means the customer's bill before tax is $25 lower.
6. A discount shows on the invoice as **its own line**, with the name sales gave it, on the printed invoice and on the emailed one. Nothing is hidden inside a unit price.
7. Invoices already issued do not change and must still print. Finance's CSV import keeps its columns.

## Not now

- A discount on one product only, discount codes, expiry dates, tax-only discounts.
- Credit notes (separate project).

## Who to ask

Priya for product questions, Dmitri in finance for anything that touches the ledger CSV.
