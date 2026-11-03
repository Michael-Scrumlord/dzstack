from catalog.api import handle


def test_get_and_update_a_price(service, mug):
    assert handle(service, "GET", f"/products/{mug}")[1]["price_cents"] == 1200
    status, _ = handle(service, "PUT", f"/products/{mug}/price", {"price_cents": 1500, "changed_by": "ada"})
    assert status == 204
    assert handle(service, "GET", f"/products/{mug}")[1]["price_cents"] == 1500


def test_missing_and_malformed_requests(service, mug):
    assert handle(service, "GET", "/products/99")[0] == 404
    assert handle(service, "PUT", f"/products/{mug}/price", {"price_cents": "lots", "changed_by": "ada"})[0] == 400
    assert handle(service, "PUT", f"/products/{mug}/price", {})[0] == 400


def test_list_shows_active_products_only(service, mug):
    handle(service, "DELETE", f"/products/{mug}")
    assert handle(service, "GET", "/products") == (200, {"products": []})
