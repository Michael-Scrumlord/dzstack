# 0004: Issued invoices are never rewritten

Status: accepted (2025-09)

`Store.issue` computes an invoice once and writes its computed form to `invoices/<number>.json`, tagged with a `format_version`. The file is never changed afterwards, and a reprint (`show`) draws the invoice from the file without recomputing anything, so a customer who asks for a copy in two years sees the amounts they were billed.

Rules for code that reads stored invoices (reprint, ledger export, reminders):

- Every file ever written must keep working. There is no migration job and we will not add one.
- A field added to the computed form later is **absent** from older files. Readers must treat a missing new field as "not applicable", never as an error.
- Old files are not edited to add new fields.
