"""A small http.server front end: GET /static/<path> serves <path> from the site folder."""
import mimetypes
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from .handler import serve

PREFIX = "/static"
CACHE_CONTROL = "public, max-age=3600"


def content_type(url_path):
    """Guess the Content-Type from the file name; extension-less names are pages."""
    name = unquote(url_path).rsplit("/", 1)[-1]
    guessed, _ = mimetypes.guess_type(name)
    if guessed:
        return guessed
    return "application/octet-stream" if "." in name else "text/html; charset=utf-8"


def make_server(root, host="127.0.0.1", port=8000):
    """Return a ThreadingHTTPServer that serves root under /static/. Call .serve_forever() to run it."""

    class Handler(BaseHTTPRequestHandler):
        def _respond(self, send_body):
            path = urlsplit(self.path).path
            if path == PREFIX or path.startswith(PREFIX + "/"):
                status, body = serve(root, path[len(PREFIX):] or "/")
            else:
                status, body = 404, b"Not Found"
            self.send_response(status)
            if status == 200:
                self.send_header("Content-Type", content_type(path))
                self.send_header("Cache-Control", CACHE_CONTROL)
            else:
                self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if send_body:
                self.wfile.write(body)

        def do_GET(self):
            self._respond(send_body=True)

        def do_HEAD(self):
            self._respond(send_body=False)

    return ThreadingHTTPServer((host, port), Handler)


def main(argv):
    if len(argv) < 2:
        sys.exit("usage: python3 -m staticsite.server <root> [port]")
    port = int(argv[2]) if len(argv) > 2 else 8000
    server = make_server(argv[1], port=port)
    print(f"serving {argv[1]} at http://127.0.0.1:{port}/static/")
    server.serve_forever()


if __name__ == "__main__":
    main(sys.argv)
