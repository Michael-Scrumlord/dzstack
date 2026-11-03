from staffdir import api


def call(conn, method, path, query=None, body=None):
    return api.handle(conn, method, path, query, body)


def test_create_then_get(conn):
    status, body = call(conn, "POST", "/users", body={"full_name": "  Ada   Lovelace ", "email": "Ada@Example.com"})
    assert status == 201
    assert body["user"]["full_name"] == "Ada Lovelace"
    assert body["user"]["email"] == "ada@example.com"
    status, body = call(conn, "GET", f"/users/{body['user']['id']}")
    assert status == 200 and body["user"]["status"] == "active"


def test_validation_errors_are_400_with_the_field(conn):
    status, body = call(conn, "POST", "/users", body={"email": "ada@example.com"})
    assert (status, body["error"], body["field"]) == (400, "validation", "full_name")
    status, body = call(conn, "POST", "/users", body={"full_name": "Ada", "email": "nope"})
    assert (status, body["field"]) == (400, "email")
    status, body = call(conn, "POST", "/users", body={"full_name": "Ada", "email": "a.b@example.org", "colour": "red"})
    assert status == 400 and "colour" in body["message"]


def test_duplicate_email_is_409(conn):
    call(conn, "POST", "/users", body={"full_name": "Ada", "email": "ada@example.com"})
    status, body = call(conn, "POST", "/users", body={"full_name": "Other Ada", "email": "ada@example.com"})
    assert (status, body["error"]) == (409, "conflict")


def test_patch_and_delete(conn):
    _, body = call(conn, "POST", "/users", body={"full_name": "Ada", "email": "ada@example.com"})
    uid = body["user"]["id"]
    status, body = call(conn, "PATCH", f"/users/{uid}", body={"full_name": "Ada Lovelace", "status": "suspended"})
    assert status == 200 and body["user"]["full_name"] == "Ada Lovelace" and body["user"]["status"] == "suspended"
    assert call(conn, "PATCH", f"/users/{uid}", body={})[0] == 400
    assert call(conn, "DELETE", f"/users/{uid}")[0] == 204
    assert call(conn, "GET", f"/users/{uid}")[0] == 404
    assert call(conn, "DELETE", f"/users/{uid}")[0] == 404


def test_listing_pages_filters_and_sorts(conn, people):
    status, body = call(conn, "GET", "/users", {"per_page": "2"})
    assert status == 200 and body["total"] == 3
    assert [u["full_name"] for u in body["users"]] == ["Ada Lovelace", "Alan Turing"]
    _, body = call(conn, "GET", "/users", {"per_page": "2", "page": "2"})
    assert [u["full_name"] for u in body["users"]] == ["Grace Hopper"]
    _, body = call(conn, "GET", "/users", {"q": "turing"})
    assert [u["email"] for u in body["users"]] == ["alan@example.com"]
    _, body = call(conn, "GET", "/users", {"team_id": str(people["platform"])})
    assert [u["full_name"] for u in body["users"]] == ["Ada Lovelace", "Grace Hopper"]
    assert call(conn, "GET", "/users", {"sort": "bogus"})[0] == 400
    assert call(conn, "GET", "/users", {"per_page": "1000"})[0] == 400


def test_team_and_roster(conn, people):
    status, body = call(conn, "GET", f"/teams/{people['platform']}")
    assert status == 200 and body["team"]["lead"]["full_name"] == "Grace Hopper"
    status, body = call(conn, "GET", f"/teams/{people['platform']}/roster")
    assert [m["full_name"] for m in body["members"]] == ["Ada Lovelace", "Grace Hopper"]
    assert call(conn, "GET", "/teams/999/roster")[0] == 404
    assert call(conn, "GET", "/teams/x")[0] == 404


def test_roster_hides_people_who_left_unless_asked(conn, people):
    call(conn, "PATCH", f"/users/{people['ada']}", body={"status": "left"})
    _, body = call(conn, "GET", f"/teams/{people['platform']}/roster")
    assert [m["full_name"] for m in body["members"]] == ["Grace Hopper"]
    _, body = call(conn, "GET", f"/teams/{people['platform']}/roster", {"include_left": "1"})
    assert len(body["members"]) == 2


def test_directory_index_and_audit(conn, people):
    status, body = call(conn, "GET", "/directory/index")
    assert status == 200
    assert {k: [u["full_name"] for u in v] for k, v in body["groups"].items()} == {
        "H": ["Grace Hopper"],
        "L": ["Ada Lovelace"],
        "T": ["Alan Turing"],
    }
    status, body = call(conn, "GET", "/audit", {"limit": "3"})
    assert status == 200 and len(body["entries"]) == 3
    assert call(conn, "GET", "/nothing/here")[0] == 404
