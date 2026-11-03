import re

_SLUG = re.compile(r"[a-z0-9][a-z0-9_.-]{0,62}\Z")


def is_valid_job_name(name: str) -> bool:
    """Job names are lowercase slugs: letters, digits, `_`, `.`, `-`; at most 63 characters; no leading punctuation."""
    return bool(_SLUG.match(name))


def slugify(text: str) -> str:
    """"Nightly Export (EU)" -> "nightly-export-eu"."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:63] or "job"
