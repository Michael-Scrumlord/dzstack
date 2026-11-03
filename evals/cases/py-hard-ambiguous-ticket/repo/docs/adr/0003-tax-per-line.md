# 0003: Tax is computed per line

Status: accepted (2025-06)

Each line carries a tax code (`standard`, `reduced`, `exempt`) and the rate depends on the code and on the customer's country (`taxes.py`). Tax is computed line by line on the line's amount, rounded (ADR-0002), and the invoice tax is the sum of the line taxes. One invoice can mix rates, and different jurisdictions require the tax of each rate to be reported separately.

Consequence: whatever changes what a customer pays for a line has to be known per line before tax is computed.
