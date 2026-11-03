import pytest


def test_second_read_comes_from_the_cache(service, mug, monkeypatch):
    service.get_product(mug)
    monkeypatch.setattr(service._store, "get_product", lambda _id: pytest.fail("store was read"))
    assert service.get_product(mug).name == "Mug"


def test_unknown_products_are_not_cached(service):
    assert service.get_product(99) is None
    service._store.add_product("Late arrival", 100)
    assert service.get_product(1) is not None


def test_new_price_is_visible_afterwards(service, mug):
    assert service.get_product(mug).price_cents == 1200
    service.update_price(mug, 1500, "ada")
    assert service.get_product(mug).price_cents == 1500


def test_price_change_is_audited(service, mug):
    service.update_price(mug, 1500, "ada")
    with service._store.transaction() as tx:
        row = tx.execute("SELECT old_cents, new_cents, changed_by FROM price_audit").fetchone()
    assert (row["old_cents"], row["new_cents"], row["changed_by"]) == (1200, 1500, "ada")


def test_updating_an_unknown_product_fails(service):
    with pytest.raises(KeyError):
        service.update_price(99, 100, "ada")


def test_discontinued_products_leave_the_storefront(service, mug):
    assert [p.id for p in service.list_active()] == [mug]
    service.get_product(mug)
    service.discontinue(mug)
    assert service.list_active() == []
    assert service.get_product(mug).active is False
