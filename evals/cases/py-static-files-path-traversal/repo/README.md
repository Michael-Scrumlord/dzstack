# staticsite

Serves the static files of our staging site (`/static/...`).

- `staticsite/handler.py` has `serve(root, url_path)`, which finds the file a request names under a folder.
- `staticsite/server.py` has `make_server(root, host="127.0.0.1", port=8000)`, a small `http.server` front end that mounts the handler at `/static/`. Run it with `python3 -m staticsite.server <root> [port]`. Pass `port=0` to let the OS pick a free port (the tests do).

Python 3.11, standard library only. Tests: `python3 -m pytest`.

## serve(root, url_path) -> (status, body)

- `root` is the folder to serve: a `str` or a path object, absolute or relative. The folder itself may be a symlink (deployments point `/srv/www` at the current release).
- `url_path` is the path of the request URL as the client sent it: percent-encoded, starting with `/`, without a query string. It is decoded once.
- `body` is `bytes`.

| status | body | when |
|---|---|---|
| 200 | the file's contents | the request names a regular file inside `root` |
| 403 | `b"Forbidden"` | the request would reach outside `root`: a path that goes up past it with `..` (written plainly or percent-encoded), or a symlink whose target is outside it |
| 404 | `b"Not Found"` | there is nothing to serve: no such file, a directory without an `index.html`, or a path that can't name a file at all (for example one with a NUL byte, `%00`) |

Rules:

- Nothing outside `root` is ever read. A request can't name a file by its absolute path either: `//etc/passwd` is not `/etc/passwd`.
- Only a whole `..` segment goes up a level. `release..notes.txt` is an ordinary file name.
- A directory is answered with its `index.html`, with or without a trailing slash (`/` is the root's own). There are no directory listings.
- On POSIX a backslash is an ordinary file name character, not a separator: `/a%5Cb.txt` names the file `a\b.txt`.
- Symlinks inside `root` are followed when their target is still inside `root` (a link to another file or folder of the site is fine). A link whose target is outside it is refused with 403. This holds for links to folders, and for an `index.html` that is a link.

## The HTTP front end

`GET /static/<path>` serves `<path>` through `serve`. Anything outside `/static/` is a 404, and the query string is ignored. The response carries the status and body from `serve`.
