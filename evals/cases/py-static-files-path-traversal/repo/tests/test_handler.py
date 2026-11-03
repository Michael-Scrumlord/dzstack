import pytest

from staticsite.handler import serve


@pytest.fixture
def site(tmp_path):
    root = tmp_path / "site"
    (root / "css").mkdir(parents=True)
    (root / "docs").mkdir()
    (root / "empty").mkdir()
    (root / "index.html").write_text("home")
    (root / "css" / "site.css").write_text("body{}")
    (root / "docs" / "index.html").write_text("docs")
    (root / "a b.txt").write_text("spaces")
    return root


def test_serves_a_file(site):
    assert serve(site, "/css/site.css") == (200, b"body{}")


def test_root_serves_the_index(site):
    assert serve(site, "/") == (200, b"home")


def test_directory_serves_its_index_with_or_without_a_slash(site):
    assert serve(site, "/docs/") == (200, b"docs")
    assert serve(site, "/docs") == (200, b"docs")


def test_directory_without_an_index_is_not_found(site):
    assert serve(site, "/empty/") == (404, b"Not Found")


def test_missing_file_is_not_found(site):
    assert serve(site, "/nope.txt") == (404, b"Not Found")


def test_percent_encoded_names_are_decoded(site):
    assert serve(site, "/a%20b.txt") == (200, b"spaces")


def test_root_can_be_a_string(site):
    assert serve(str(site), "/css/site.css") == (200, b"body{}")
