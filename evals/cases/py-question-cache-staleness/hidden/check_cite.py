"""Does ANSWER.md cite one of the given places: file and a line within TOLERANCE of a span?

usage: check_cite.py service.py:25-31 store.py:54   (a target is <file>:<first line>[-<last line>])
Accepted forms: `catalog/service.py:25`, `service.py:23-34`, `service.py line 25`, `service.py, lines 25-26`,
`line 25 of service.py`, `service.py (L25)`, a table row `| service.py | 25 |`.
Env: ANSWER (default /work/ANSWER.md).
"""
import os
import re
import sys

TOLERANCE = 3
MAX_RANGE = 25  # a wider range proves nothing; only its end points count
ANSWER = os.environ.get("ANSWER", "/work/ANSWER.md")

NUM = r"L?(\d+)(?:\s*(?:-|–|—|to|\.\.)\s*(?:lines?\s*)?L?(\d+))?"
AFTER_DIRECT = re.compile(r"^[`'\"*)\]\s]{0,4}(?::|#)\s*" + NUM)
AFTER_COLUMN = re.compile(r"^[`'\"*)\]]{0,3}\s*[|,]\s*" + NUM + r"\b")
AFTER_PAREN = re.compile(r"^[`'\"*]{0,3}\s*\(\s*" + NUM)
AFTER_WORD = re.compile(r"\b(?:lines?|ln|L)\.?\s*[:#]?\s*\**\s*" + NUM, re.I)
BEFORE_WORD = re.compile(r"\b(?:lines?|ln|L)\.?\s*[:#]?\s*" + NUM + r"[^\d]{0,14}$", re.I)
OTHER_FILE = re.compile(r"[\w/.-]+\.py\b")


def pairs(matches):
    return [(int(m.group(1)), int(m.group(2)) if m.group(2) else None) for m in matches]


def ranges_after(text, end):
    window = text[end:end + 120]
    other = OTHER_FILE.search(window)
    if other:
        window = window[:other.start()]
    found = [m for m in (p.search(window) for p in (AFTER_DIRECT, AFTER_COLUMN, AFTER_PAREN)) if m]
    return pairs(found + list(AFTER_WORD.finditer(window)))


def ranges_before(text, start):
    m = BEFORE_WORD.search(text[max(0, start - 45):start])
    return pairs([m]) if m else []


def citations(text, name):
    for m in re.finditer(r"(?<![A-Za-z0-9_])" + re.escape(name), text):
        yield from ranges_after(text, m.end())
        yield from ranges_before(text, m.start())


def hits(cited, lo, hi):
    lo, hi = lo - TOLERANCE, hi + TOLERANCE
    a, b = cited
    if b is None:
        return lo <= a <= hi
    if b < a or b - a > MAX_RANGE:
        return lo <= a <= hi or lo <= b <= hi
    return a <= hi and b >= lo


def main():
    try:
        text = open(ANSWER, encoding="utf-8", errors="replace").read()
    except OSError:
        print("no ANSWER.md")
        return 1
    for target in sys.argv[1:]:
        name, _, span = target.partition(":")
        lo, _, hi = span.partition("-")
        lo, hi = int(lo), int(hi or lo)
        for cited in citations(text, name):
            if hits(cited, lo, hi):
                print(f"ok: {name} line {cited[0]}" + (f"-{cited[1]}" if cited[1] else "") + f" is within {TOLERANCE} of {lo}-{hi}")
                return 0
    print("no citation of " + " or ".join(sys.argv[1:]) + f" (within {TOLERANCE} lines)")
    return 1


sys.exit(main())
