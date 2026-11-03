import pytest

from catalog.api import build_service


@pytest.fixture
def service(tmp_path):
    return build_service(str(tmp_path / "catalog.db"))


@pytest.fixture
def mug(service):
    """The id of a product costing 12.00."""
    return service._store.add_product("Mug", 1200)
