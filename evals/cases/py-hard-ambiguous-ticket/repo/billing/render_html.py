"""The emailed invoice: HTML built from the same computed form as the printed one. Everything that comes from the
document is escaped."""
from __future__ import annotations

from html import escape

from .money import format_cents


def render_html(data: dict) -> str:
    cur = data["currency"]
    money = lambda cents: escape(format_cents(cents, cur))  # noqa: E731
    customer = data["customer"]
    title = f"Invoice {data['number']}" if data.get("number") else "Invoice (draft)"
    rows = []
    for line in data["lines"]:
        rows.append(
            "<tr>"
            f"<td>{escape(line['sku'])}</td><td>{escape(line['description'])}</td>"
            f"<td class=\"num\">{escape(line['quantity'])}</td>"
            f"<td class=\"num\">{money(line['unit_price_cents'])}</td>"
            f"<td class=\"num\">{money(line['amount_cents'])}</td>"
            "</tr>"
        )
    foot = [
        f"<tr class=\"subtotal\"><th colspan=\"4\">Subtotal</th><td class=\"num\">{money(data['subtotal_cents'])}</td></tr>",
        f"<tr class=\"tax\"><th colspan=\"4\">Tax</th><td class=\"num\">{money(data['tax_cents'])}</td></tr>",
        f"<tr class=\"total\"><th colspan=\"4\">Total</th><td class=\"num\">{money(data['total_cents'])}</td></tr>",
    ]
    parts = [
        "<article class=\"invoice\">",
        f"<h1>{escape(title)}</h1>",
        f"<p class=\"meta\">Issued {escape(data['issued'])}</p>",
        f"<p class=\"customer\">{escape(customer['name'])} ({escape(customer['country'])})</p>",
        "<table>",
        "<thead><tr><th>SKU</th><th>Description</th><th class=\"num\">Qty</th><th class=\"num\">Unit price</th><th class=\"num\">Amount</th></tr></thead>",
        "<tbody>",
        *rows,
        "</tbody>",
        "<tfoot>",
        *foot,
        "</tfoot>",
        "</table>",
        f"<p class=\"terms\">Payment due within {data['terms_days']} days of the invoice date.</p>",
    ]
    if data.get("notes"):
        parts.append(f"<p class=\"notes\">{escape(data['notes'])}</p>")
    parts.append("</article>")
    return "\n".join(parts) + "\n"
