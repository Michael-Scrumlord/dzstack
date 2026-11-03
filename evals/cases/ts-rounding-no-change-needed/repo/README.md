# ledger-money

Money formatting for the billing service's ledger reports.

Amounts are integer cents. A few inputs (usage-based prices, pro-rata charges) arrive as fractional cents; they are rounded once, at the edge, by `formatAmount`, `fromDollars` and `renderLedger`.

```ts
import { formatAmount, formatDollars } from "./src/money.ts";

formatAmount(123456);    // "$1,234.56"
formatAmount(-5);        // "-$0.05"
formatDollars(19.99);    // "$19.99"
```

- `src/money.ts`: `roundHalfEven`, `fromDollars`, `formatAmount`, `formatDollars`, `parseAmount`, `splitEvenly`.
- `src/ledger.ts`: `renderLedger` prints entries and a total as plain text for the monthly report.

## Rounding

All rounding in this package is **half to even** ("banker's rounding"): a value exactly halfway between two cents goes to the even cent. 2.5 cents becomes 2, 3.5 cents becomes 4, and 12.5 cents (0.125 dollars) becomes 12. Anything that is not exactly halfway goes to the nearest cent.

The finance team requires this for the ledger reports (agreed in the June 2025 close review). Round-half-up always pushes ties the same way, so the error adds up in one direction over thousands of ledger lines; half to even cancels out. The bank's statements also round half to even, and our totals are reconciled against them. Changing the rule changes reported figures, so it needs finance's sign-off.

## Tests

```
npm test
```
