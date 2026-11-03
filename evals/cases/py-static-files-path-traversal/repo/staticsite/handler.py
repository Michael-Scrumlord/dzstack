"""Find the file a request URL names under a site folder.

serve(root, url_path) -> (status, body). The rules are in README.md.
"""
import os
from urllib.parse import unquote

INDEX_NAME = "index.html"

OK = 200
NOT_FOUND = 404

_BODIES = {NOT_FOUND: b"Not Found"}


def _reply(status):
    return status, _BODIES[status]


def serve(root, url_path):
    """Return (status, body) for GET url_path against the folder root."""
    relative = unquote(url_path).removeprefix("/")
    path = os.path.join(root, relative)
    if os.path.isdir(path):
        path = os.path.join(path, INDEX_NAME)
    if not os.path.isfile(path):
        return _reply(NOT_FOUND)
    with open(path, "rb") as f:
        return OK, f.read()
