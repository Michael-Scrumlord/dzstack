"""The invoice store: one JSON file per issued invoice (ADR-0004). Issued invoices are never rewritten."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from . import api
from .document import parse_invoice
from .errors import StoreError
from .numbering import next_number

FORMAT_VERSION = 1


class Store:
    def __init__(self, root) -> None:
        self.root = Path(root)
        self.dir = self.root / "invoices"

    def issue(self, doc) -> str:
        """Compute the document, give it the next number and write it. Returns the number."""
        invoice = parse_invoice(doc)
        self.dir.mkdir(parents=True, exist_ok=True)
        number = next_number(self.root, invoice.issued.year)
        data = api.compute({**doc, "number": number})
        stored = {"format_version": FORMAT_VERSION, **data}
        try:
            with open(self.dir / f"{number}.json", "x", encoding="utf-8") as handle:
                handle.write(json.dumps(stored, indent=2, sort_keys=True) + "\n")
        except FileExistsError:
            raise StoreError(f"invoice {number} already exists; issued invoices are never rewritten") from None
        return number

    def load(self, number: str) -> dict:
        path = self.dir / f"{number}.json"
        if not path.exists():
            raise StoreError(f"no invoice {number}")
        return json.loads(path.read_text(encoding="utf-8"))

    def numbers(self) -> list[str]:
        return sorted(p.stem for p in self.dir.glob("*.json")) if self.dir.exists() else []

    def all(self) -> list[dict]:
        return [self.load(n) for n in self.numbers()]

    def show(self, number: str, fmt: str = "text") -> str:
        return api.render_stored(self.load(number), fmt)


def issued_on(data: dict) -> date:
    return date.fromisoformat(data["issued"])
