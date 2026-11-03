"""Hidden checks for the static file handler. Every test builds its own folders under tmp_path."""
import http.client
import os
import threading
from pathlib import Path

import pytest

from staticsite.handler import serve
from staticsite.server import make_server

SECRET = b"TOP-SECRET: not for the web"
# EVAL_LENIENT_STATUS=1: a refusal may be the README's 403 or a 404, as long as nothing leaks.
# The strict check (unset) holds the README's 403.
LENIENT = os.environ.get("EVAL_LENIENT_STATUS") == "1"


class _Refused:
    def __eq__(self, other):
        return other == (403, b"Forbidden") or (LENIENT and other == (404, b"Not Found"))

    def __repr__(self):
        return "(403, b'Forbidden')" + (" or (404, b'Not Found')" if LENIENT else "")


FORBIDDEN = _Refused()
NOT_FOUND = (404, b"Not Found")


class Layout:
    def __init__(self, base: Path):
        self.base = base
        self.root = base / "site"
        self.www = base / "www"  # a symlink to the root, the way a deployment points at a release
        self.abs_secret = str(base / "outside" / "secret.txt")


@pytest.fixture
def layout(tmp_path):
    base = Path(os.path.realpath(tmp_path))
    root = base / "site"
    outside = base / "outside"
    private = base / "site-private"  # shares the root's name as a prefix
    for d in (root / "docs" / "guide", root / "empty", root / "leakindex", outside, private):
        d.mkdir(parents=True)
    (base / "secret.txt").write_bytes(SECRET)
    (outside / "secret.txt").write_bytes(SECRET)
    (outside / "index.html").write_bytes(SECRET)
    (private / "secret.txt").write_bytes(SECRET)

    (root / "index.html").write_bytes(b"home")
    (root / "hello.txt").write_bytes(b"hello")
    (root / "a b.txt").write_bytes(b"spaces")
    (root / "release..notes.txt").write_bytes(b"dots in a name")
    (root / "docs" / "index.html").write_bytes(b"docs")
    (root / "docs" / "guide" / "intro.txt").write_bytes(b"intro")
    # POSIX file names that contain backslashes
    (root / "a\\b.txt").write_bytes(b"backslash name")
    (root / "..\\secret.txt").write_bytes(b"backslash dots")

    # links that stay inside the root
    os.symlink("hello.txt", root / "alias.txt")
    os.symlink("docs", root / "current")
    # links that leave it
    os.symlink("../outside/secret.txt", root / "leak.txt")
    os.symlink(str(outside / "secret.txt"), root / "leak-abs.txt")
    os.symlink("../outside", root / "leakdir")
    os.symlink("../..", root / "docs" / "up")
    os.symlink("../../outside/secret.txt", root / "leakindex" / "index.html")

    os.symlink(root, base / "www")
    return Layout(base)


@pytest.fixture(params=["path", "str"])
def root(layout, request):
    return layout.root if request.param == "path" else str(layout.root)


def refused_or_missing(result):
    status, body = result
    assert status in (403, 404), result
    assert SECRET not in body, result


class TestTraversal:
    @pytest.mark.parametrize(
        "url",
        [
            "/../secret.txt",
            "/./../secret.txt",
            "/docs/../../secret.txt",
            "/docs/guide/../../../secret.txt",
            "/../outside/secret.txt",
            "/docs/../../outside/secret.txt",
        ],
    )
    def test_plain_dotdot(self, root, url):
        assert serve(root, url) == FORBIDDEN

    @pytest.mark.parametrize(
        "url",
        [
            "/%2e%2e%2fsecret.txt",
            "/%2e%2e/secret.txt",
            "/%2E%2E%2Fsecret.txt",
            "/..%2fsecret.txt",
            "/.%2e/secret.txt",
            "/docs/%2e%2e/%2e%2e/secret.txt",
            "/docs/..%2f..%2fsecret.txt",
            "/%2e%2e%2foutside/secret.txt",
        ],
    )
    def test_encoded_dotdot(self, root, url):
        assert serve(root, url) == FORBIDDEN

    @pytest.mark.parametrize(
        "url",
        ["/../site-private/secret.txt", "/%2e%2e/site-private/secret.txt", "/docs/../../site-private/secret.txt"],
    )
    def test_sibling_folder_sharing_the_root_name_as_prefix(self, root, url):
        assert serve(root, url) == FORBIDDEN

    @pytest.mark.parametrize("url", ["/..", "/../", "/%2e%2e", "/%2e%2e/", "/../outside", "/../outside/", "/docs/../.."])
    def test_folders_outside_the_root(self, root, url):
        assert serve(root, url) == FORBIDDEN

    def test_absolute_paths(self, layout, root):
        absolute = layout.abs_secret
        for url in (
            "/" + absolute,  # //tmp/.../secret.txt
            "///" + absolute.lstrip("/"),
            "/%2F" + absolute.lstrip("/"),
            "/%2f%2f" + absolute.lstrip("/"),
            "/" + absolute.replace("/", "%2F"),
            "/" + str(layout.base / "secret.txt"),
        ):
            refused_or_missing(serve(root, url))

    def test_double_encoding_is_decoded_only_once(self, root):
        refused_or_missing(serve(root, "/%252e%252e%252fsecret.txt"))
        refused_or_missing(serve(root, "/%252e%252e/secret.txt"))

    def test_relative_root(self, layout, monkeypatch):
        monkeypatch.chdir(layout.base)
        assert serve("site", "/../secret.txt") == FORBIDDEN
        assert serve("site", "/%2e%2e%2fsecret.txt") == FORBIDDEN
        assert serve("./site", "/docs/../../outside/secret.txt") == FORBIDDEN

    def test_root_given_with_a_trailing_slash(self, layout):
        assert serve(str(layout.root) + "/", "/../secret.txt") == FORBIDDEN
        assert serve(str(layout.root) + "/", "/../site-private/secret.txt") == FORBIDDEN

    def test_traversal_through_a_symlinked_root(self, layout):
        assert serve(layout.www, "/../secret.txt") == FORBIDDEN
        assert serve(str(layout.www), "/%2e%2e%2fsecret.txt") == FORBIDDEN


class TestSymlinks:
    @pytest.mark.parametrize("url", ["/leak.txt", "/leak-abs.txt", "/leak%2Etxt", "/%6Ceak.txt"])
    def test_file_link_pointing_outside(self, root, url):
        assert serve(root, url) == FORBIDDEN

    @pytest.mark.parametrize("url", ["/leakdir/secret.txt", "/leakdir/index.html", "/docs/up/secret.txt", "/docs/up/outside/secret.txt"])
    def test_folder_link_pointing_outside(self, root, url):
        assert serve(root, url) == FORBIDDEN

    @pytest.mark.parametrize("url", ["/leakdir", "/leakdir/", "/docs/up", "/docs/up/"])
    def test_a_folder_link_pointing_outside_is_not_served_as_a_directory(self, root, url):
        status, body = serve(root, url)
        assert (status, body) == FORBIDDEN

    @pytest.mark.parametrize("url", ["/leakindex", "/leakindex/"])
    def test_index_that_is_a_link_pointing_outside(self, root, url):
        assert serve(root, url) == FORBIDDEN

    def test_links_are_still_refused_when_the_root_is_a_symlink(self, layout):
        for url in ("/leak.txt", "/leakdir/secret.txt", "/leakindex/"):
            assert serve(layout.www, url) == FORBIDDEN
            assert serve(str(layout.www), url) == FORBIDDEN


class TestServing:
    def test_nested_files(self, root):
        assert serve(root, "/hello.txt") == (200, b"hello")
        assert serve(root, "/docs/guide/intro.txt") == (200, b"intro")
        assert serve(root, "/docs/guide/%69ntro.txt") == (200, b"intro")
        assert serve(root, "/a%20b.txt") == (200, b"spaces")

    def test_names_with_two_dots_are_ordinary(self, root):
        assert serve(root, "/release..notes.txt") == (200, b"dots in a name")
        assert serve(root, "/release%2e%2enotes.txt") == (200, b"dots in a name")

    @pytest.mark.parametrize("url", ["/nope.txt", "/docs/nope.txt", "/nope/deeper/file.txt", "/hello.txt/more", "/docs/guide/intro.txt/x"])
    def test_missing_is_not_found(self, root, url):
        assert serve(root, url) == NOT_FOUND

    def test_directories(self, root):
        assert serve(root, "/") == (200, b"home")
        assert serve(root, "/docs") == (200, b"docs")
        assert serve(root, "/docs/") == (200, b"docs")

    def test_directories_without_an_index_are_not_listed(self, root):
        for url in ("/empty", "/empty/", "/docs/guide", "/docs/guide/"):
            assert serve(root, url) == NOT_FOUND

    def test_backslash_is_an_ordinary_character(self, root):
        assert serve(root, "/a%5Cb.txt") == (200, b"backslash name")
        assert serve(root, "/a\\b.txt") == (200, b"backslash name")
        # a file that really is called ..\secret.txt, not a way up
        assert serve(root, "/..%5Csecret.txt") == (200, b"backslash dots")
        assert serve(root, "/%2e%2e%5csecret.txt") == (200, b"backslash dots")

    def test_backslash_is_not_a_separator(self, root):
        assert serve(root, "/docs%5Cguide%5Cintro.txt") == NOT_FOUND
        assert serve(root, "/..%5C..%5Cetc%5Cpasswd") == NOT_FOUND
        refused_or_missing(serve(root, "/..%5Coutside%5Csecret.txt"))

    def test_links_that_stay_inside_the_root_are_followed(self, root):
        assert serve(root, "/alias.txt") == (200, b"hello")
        assert serve(root, "/current/index.html") == (200, b"docs")
        assert serve(root, "/current/guide/intro.txt") == (200, b"intro")
        assert serve(root, "/current") == (200, b"docs")
        assert serve(root, "/current/") == (200, b"docs")

    def test_the_root_may_be_a_symlink(self, layout):
        for root in (layout.www, str(layout.www)):
            assert serve(root, "/hello.txt") == (200, b"hello")
            assert serve(root, "/docs/guide/intro.txt") == (200, b"intro")
            assert serve(root, "/") == (200, b"home")
            assert serve(root, "/docs/") == (200, b"docs")
            assert serve(root, "/alias.txt") == (200, b"hello")
            assert serve(root, "/current/guide/intro.txt") == (200, b"intro")
            assert serve(root, "/nope.txt") == NOT_FOUND

    def test_a_relative_root(self, layout, monkeypatch):
        monkeypatch.chdir(layout.base)
        assert serve("site", "/hello.txt") == (200, b"hello")
        assert serve("./site", "/docs/") == (200, b"docs")
        assert serve("www", "/docs/guide/intro.txt") == (200, b"intro")
        assert serve("site", "/nope.txt") == NOT_FOUND

    def test_a_root_with_a_trailing_slash(self, layout):
        assert serve(str(layout.root) + "/", "/hello.txt") == (200, b"hello")
        assert serve(str(layout.www) + "/", "/docs/guide/intro.txt") == (200, b"intro")


class TestUnnamable:
    """The README: a path that can't name a file at all (a NUL byte) is just not found."""

    @pytest.mark.parametrize("url", ["/hello.txt%00.png", "/hello.txt%00", "/%00", "/docs/%00/intro.txt", "/..%00/secret.txt"])
    def test_nul_byte_is_not_found(self, root, url):
        assert serve(root, url) == NOT_FOUND


@pytest.fixture
def port(layout):
    server = make_server(layout.root, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1]
    server.shutdown()
    server.server_close()


def fetch(port, path, method="GET"):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        conn.request(method, path)  # http.client sends the path exactly as given
        response = conn.getresponse()
        return response.status, response.read()
    finally:
        conn.close()


class TestHttp:
    @pytest.mark.parametrize(
        "url",
        [
            "/static/../secret.txt",
            "/static/%2e%2e/secret.txt",
            "/static/..%2fsecret.txt",
            "/static/docs/../../secret.txt",
            "/static/docs/%2e%2e%2f%2e%2e%2fsecret.txt",
            "/static/leak.txt",
            "/static/leakdir/secret.txt",
            "/static/leakindex/",
        ],
    )
    def test_nothing_outside_the_folder_comes_back(self, port, url):
        for method in ("GET", "HEAD"):
            status, body = fetch(port, url, method)
            assert status == 403 or (LENIENT and status == 404), (method, url, status)
            assert SECRET not in body

    def test_absolute_paths_over_http(self, layout, port):
        for url in ("/static/" + layout.abs_secret, "/static//" + layout.abs_secret.lstrip("/"), "/static/%2F" + layout.abs_secret.lstrip("/")):
            status, body = fetch(port, url)
            assert status in (403, 404), (url, status)
            assert SECRET not in body

    def test_legitimate_requests_over_http(self, port):
        assert fetch(port, "/static/hello.txt") == (200, b"hello")
        assert fetch(port, "/static/docs/guide/intro.txt?v=2") == (200, b"intro")
        assert fetch(port, "/static/") == (200, b"home")
        assert fetch(port, "/static/alias.txt") == (200, b"hello")
        assert fetch(port, "/static/a%5Cb.txt") == (200, b"backslash name")
        assert fetch(port, "/static/nope.txt") == (404, b"Not Found")
        assert fetch(port, "/static/empty/") == (404, b"Not Found")
        assert fetch(port, "/hello.txt")[0] == 404
