"""`handle` maps a request to a service call and returns (status, body)."""
import re
from dataclasses import asdict

from catalog.cache import TTLCache
from catalog.service import PRODUCT_TTL_SECONDS, CatalogService
from catalog.store import Store


def build_service(db_path):
    return CatalogService(Store(db_path), TTLCache(PRODUCT_TTL_SECONDS))


def handle(service, method, path, body=None):
    match = re.fullmatch(r"/products/(\d+)", path)
    price_match = re.fullmatch(r"/products/(\d+)/price", path)
    try:
        if method == "GET" and path == "/products":
            return 200, {"products": [asdict(p) for p in service.list_active()]}
        if method == "GET" and match:
            product = service.get_product(int(match.group(1)))
            return (200, asdict(product)) if product else (404, {"error": "not found"})
        if method == "PUT" and price_match:
            if not isinstance(body, dict) or "price_cents" not in body or "changed_by" not in body:
                return 400, {"error": "bad request"}
            service.update_price(int(price_match.group(1)), int(body["price_cents"]), str(body["changed_by"]))
            return 204, {}
        if method == "DELETE" and match:
            service.discontinue(int(match.group(1)))
            return 204, {}
    except KeyError:
        return 404, {"error": "not found"}
    except (TypeError, ValueError):
        return 400, {"error": "bad request"}
    return 404, {"error": "not found"}
