from app.routes import handle


def test_checkout_and_list_loans(conn, seeded, today):
    member_id, book_ids = seeded
    status, body = handle(conn, "POST", "/loans", {}, {"member_id": member_id, "book_id": book_ids[0]}, today)
    assert status == 201
    status, body = handle(conn, "GET", f"/members/{member_id}/loans", {}, None, today)
    assert status == 200 and len(body["loans"]) == 1


def test_refused_checkout_is_a_409(conn, seeded, today):
    member_id, book_ids = seeded
    payload = {"member_id": member_id, "book_id": book_ids[0]}
    handle(conn, "POST", "/loans", {}, payload, today)
    status, body = handle(conn, "POST", "/loans", {}, payload, today)
    assert status == 409 and "already on loan" in body["error"]


def test_unknown_route_is_a_404(conn, today):
    assert handle(conn, "GET", "/nope", {}, None, today)[0] == 404
