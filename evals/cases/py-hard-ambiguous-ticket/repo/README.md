# billing

Invoicing for Paperly. An invoice **document** (JSON) goes in; out come the computed amounts, a printed invoice (text), an emailed invoice (HTML), an invoice store and the ledger CSV that finance imports.

```
billing/
  document.py       parse and validate a document (strict: unknown fields are errors)
  calc.py           amounts: lines, tax, totals
  money.py taxes.py cents, the one rounding function, tax rates
  render_text.py render_html.py layout.py     the printed and the emailed invoice
  store.py numbering.py                        issued invoices, one JSON file each
  export.py reminders.py installments.py       ledger CSV, payment reminders, payment plans
  api.py cli.py                                the front doors
docs/               product notes, decision records (adr/), glossary, document and rendering formats
tests/
```

## Use

```
python -m billing compute invoice.json            # computed form, JSON
python -m billing render invoice.json [--format html]
python -m billing issue invoice.json --store ./store      # prints the new number
python -m billing show 2026-0001 --store ./store [--format html]
python -m billing export --store ./store          # ledger CSV
python -m billing remind --store ./store --today 2026-04-15 [--paid 2026-0001 ...]
python -m billing plan 120000 6 --first-due 2026-04-01
```

From Python: `billing.api.compute(doc)` returns the computed dict, `billing.api.render(doc, "text" | "html")` the invoice as a string. Both raise `billing.errors.DocumentError` for an invalid document; the command line prints `error: ...` and exits with status 2.

## Tests

```
python3 -m pytest -q
```

## Read before changing behaviour

`docs/` is the team's memory: why money is integer cents and how it is rounded (`adr/0001`, `adr/0002`), why tax is per line (`adr/0003`), what we promised about stored invoices and the finance export (`adr/0004`, `adr/0005`), the vocabulary (`glossary.md`) and what the document and the rendered invoice look like (`invoice-format.md`, `rendering.md`).
