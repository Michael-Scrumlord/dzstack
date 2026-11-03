# 0005: The ledger CSV is a contract with finance

Status: accepted (2025-11)

`billing export` writes one row per issued invoice with the columns `number, issued, customer, currency, subtotal, tax, total`, amounts as plain decimals (`49.00`).

Finance's importer posts these rows to the ledger. It rejects a file whose header differs from the one above, and it rejects any row where `subtotal + tax` is not equal to `total`. New columns need finance's sign-off first; a feature never adds, renames or reorders columns on its own.

`subtotal` is the amount, before tax, that the customer is charged; `tax` is the tax charged; `total` is the amount due.
