import http.client
import threading

import pytest

from staticsite.server import make_server


@pytest.fixture
def port(tmp_path):
    root = tmp_path / "site"
    root.mkdir()
    (root / "hello.txt").write_text("hello")
    (root / "page.html").write_text("<p>hi</p>")
    server = make_server(root, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1]
    server.shutdown()
    server.server_close()


def get(port, path, method="GET"):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.request(method, path)
        response = conn.getresponse()
        return response.status, response.read(), response.getheader("Content-Type")
    finally:
        conn.close()


def test_serves_files_under_static(port):
    assert get(port, "/static/hello.txt") == (200, b"hello", "text/plain")
    assert get(port, "/static/page.html")[2] == "text/html"


def test_missing_file_is_a_404(port):
    assert get(port, "/static/nope.txt")[:2] == (404, b"Not Found")


def test_paths_outside_static_are_a_404(port):
    assert get(port, "/hello.txt")[0] == 404
    assert get(port, "/staticfiles/hello.txt")[0] == 404


def test_query_string_is_ignored(port):
    assert get(port, "/static/hello.txt?v=3")[:2] == (200, b"hello")


def test_head_has_no_body(port):
    assert get(port, "/static/hello.txt", method="HEAD") == (200, b"", "text/plain")
    assert get(port, "/static/nope.txt", method="HEAD")[0] == 404
