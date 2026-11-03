"""Does REVIEW.md point at one planted defect: its file and a line within TOLERANCE of it?

usage: check_review.py <defect id>
Reads the defects (file plus the text of the first and last added line) from defects.json,
finds their line numbers in PR.diff, then looks for file and line references in REVIEW.md.
Accepted forms include `app/members.py:16`, `members.py:16-17`, `members.py line 16`,
`line 16 of members.py`, `members.py, L16`, a table row `| members.py | 16 |`, and the same
with PR.diff for the line numbers of the diff file itself.
Env: REVIEW (default /work/REVIEW.md), DIFF (default /orig/PR.diff), DEFECTS (default /hidden/defects.json).
"""
import json
import os
import re
import sys

TOLERANCE = 3
MAX_RANGE = 25  # a wider range proves nothing; only its end points count

REVIEW = os.environ.get("REVIEW", "/work/REVIEW.md")
DIFF = os.environ.get("DIFF", "/orig/PR.diff")
DEFECTS = os.environ.get("DEFECTS", "/hidden/defects.json")


def added_lines(diff_text):
    """[(file, new_line_number, text, diff_file_line_number)] for every added line."""
    out, path, new_no = [], None, 0
    for i, line in enumerate(diff_text.splitlines(), 1):
        if line.startswith("+++ "):
            path = line[4:].strip()
            path = path[2:] if path.startswith("b/") else path
        elif line.startswith("@@"):
            m = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)", line)
            new_no = int(m.group(1)) if m else 0
        elif path and new_no and line.startswith("+"):
            out.append((path, new_no, line[1:], i))
            new_no += 1
        elif path and new_no and line.startswith(" "):
            new_no += 1
    return out


def locate(defect, added):
    def find(marker):
        hits = [(n, d) for f, n, t, d in added if f == defect["file"] and marker in t]
        if len(hits) != 1:
            sys.exit(f"harness error: {marker!r} matches {len(hits)} added lines in {defect['file']}")
        return hits[0]

    s_line, s_diff = find(defect["start"])
    e_line, e_diff = find(defect["end"]) if defect.get("end") else (s_line, s_diff)
    return (s_line, e_line), (s_diff, e_diff)


NUM = r"L?(\d+)(?:\s*(?:-|–|—|to|\.\.)\s*(?:lines?\s*)?L?(\d+))?"
AFTER_DIRECT = re.compile(r"^[`'\"*)\]\s]{0,4}(?::|#)\s*" + NUM)
AFTER_COLUMN = re.compile(r"^[`'\"*)\]]{0,3}\s*[|,]\s*" + NUM + r"\b")
AFTER_WORD = re.compile(r"\b(?:lines?|ln|L)\.?\s*[:#]?\s*\**\s*" + NUM, re.I)
AFTER_PAREN = re.compile(r"^[`'\"*]{0,3}\s*\(\s*" + NUM)
BEFORE_WORD = re.compile(r"\b(?:lines?|ln|L)\.?\s*[:#]?\s*" + NUM + r"[^\d]{0,14}$", re.I)
OTHER_FILE = re.compile(r"[\w/.-]+\.py\b|PR\.diff")


def ranges_after(text, end):
    window = text[end:end + 120]
    other = OTHER_FILE.search(window)
    if other:
        window = window[:other.start()]
    found = []
    for pat in (AFTER_DIRECT, AFTER_COLUMN, AFTER_PAREN):
        m = pat.search(window)
        if m:
            found.append(m)
    found += AFTER_WORD.finditer(window)
    return [(int(m.group(1)), int(m.group(2)) if m.group(2) else None) for m in found]


def ranges_before(text, start):
    m = BEFORE_WORD.search(text[max(0, start - 45):start])
    return [(int(m.group(1)), int(m.group(2)) if m.group(2) else None)] if m else []


def citations(text, name):
    pat = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(name))
    for m in pat.finditer(text):
        yield from ranges_after(text, m.end())
        yield from ranges_before(text, m.start())


def hits(cited, span):
    lo, hi = span[0] - TOLERANCE, span[1] + TOLERANCE
    a, b = cited
    if b is None:
        return lo <= a <= hi
    if b < a or b - a > MAX_RANGE:
        return lo <= a <= hi or lo <= b <= hi
    return a <= hi and b >= lo


def main():
    want = sys.argv[1]
    defect = next(d for d in json.load(open(DEFECTS)) if d["id"] == want)
    try:
        review = open(REVIEW, encoding="utf-8", errors="replace").read()
    except OSError:
        print("no REVIEW.md")
        return 1
    spans = locate(defect, added_lines(open(DIFF, encoding="utf-8", errors="replace").read()))
    base = os.path.basename(defect["file"])
    for name, span in ((base, spans[0]), ("PR.diff", spans[1])):
        for cited in citations(review, name):
            if hits(cited, span):
                print(f"ok: {name} line {cited[0]}" + (f"-{cited[1]}" if cited[1] else "") + f" is within {TOLERANCE} of {span}")
                return 0
    print(f"no reference to {defect['file']} (or PR.diff) near line(s) {spans[0][0]}-{spans[0][1]} "
          f"(PR.diff lines {spans[1][0]}-{spans[1][1]}), tolerance {TOLERANCE}")
    return 1


sys.exit(main())
