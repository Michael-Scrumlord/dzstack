# 0002: Rounding

Status: accepted (2025-06)

Rounding to whole cents is **half up, away from zero**: 2.5 cents becomes 3, 154.5 becomes 155, -2.5 becomes -3. `money.round_cents` is the only place that does it.

Do not use Python's `round()` or `Decimal`'s default context: both round ties to even (154.5 becomes 154), which puts the invoice a cent away from what finance's ledger computes.

Rounding happens **per line**. Each line's amount, and each line's tax, is rounded on its own and the invoice figures are sums of the rounded line figures. We never compute a figure for the whole invoice and round that.
