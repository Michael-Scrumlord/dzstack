"""The printed invoice. It is drawn from the computed form (a dict), so a stored invoice reprints with exactly the
numbers it was issued with."""
from __future__ import annotations

from .layout import RULE, ends, fit, left, right, total_row
from .money import format_cents

TERMS_LINE = "Payment due within {days} days of the invoice date."


def render_text(data: dict) -> str:
    cur = data["currency"]
    money = lambda cents: format_cents(cents, cur)  # noqa: E731
    title = f"INVOICE {data['number']}" if data.get("number") else "INVOICE (draft)"
    customer = data["customer"]
    out = [ends(title, f"Issued {data['issued']}"), f"{customer['name']} ({customer['country']})"]
    if customer.get("email"):
        out.append(customer["email"])
    out += [
        "",
        left("SKU", 10) + " " + left("Description", 26) + " " + right("Qty", 8) + " " + right("Unit price", 12) + " " + right("Amount", 12),
        RULE,
    ]
    for line in data["lines"]:
        out.append(
            left(line["sku"], 10)
            + " "
            + left(line["description"], 26)
            + " "
            + right(line["quantity"], 8)
            + " "
            + right(money(line["unit_price_cents"]), 12)
            + " "
            + right(money(line["amount_cents"]), 12)
        )
    out += [RULE, total_row("Subtotal", money(data["subtotal_cents"]))]
    out += [total_row("Tax", money(data["tax_cents"])), total_row("TOTAL", money(data["total_cents"])), ""]
    out.append(TERMS_LINE.format(days=data["terms_days"]))
    if data.get("notes"):
        out.append(fit("Notes: " + data["notes"].replace("\n", " "), 200))
    return "\n".join(out) + "\n"
