# catalog

A small product catalog service: names, prices and an active flag in SQLite, with an in-process cache in front of single-product lookups.

- `catalog/store.py`: SQLite access. Every call opens its own short connection, so threads never share one. `Store.transaction()` commits when its block ends and rolls back if it raises.
- `catalog/cache.py`: `TTLCache`, a lock-protected dict whose entries expire after a fixed time.
- `catalog/service.py`: `CatalogService`, the operations behind the API. `get_product` is cached (5 minutes, `PRODUCT_TTL_SECONDS`); the write operations drop the cached entry of the product they change. `list_active` is not cached.
- `catalog/api.py`: `handle(service, method, path, body)` returns `(status, json_body)`. The HTTP server (not in this repository) calls it from one thread per request.

The service runs as a single process, so there is exactly one cache.

## Tests

```
python3 -m pytest
```
