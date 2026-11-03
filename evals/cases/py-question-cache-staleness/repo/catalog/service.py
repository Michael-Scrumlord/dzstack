"""The operations behind the API."""
PRODUCT_TTL_SECONDS = 300


class CatalogService:
    def __init__(self, store, cache):
        self._store = store
        self._cache = cache

    def get_product(self, product_id):
        """One product, from the cache if it is there, otherwise from the store (and then cached)."""
        product = self._cache.get(product_id)
        if product is not None:
            return product
        product = self._store.get_product(product_id)
        if product is not None:
            self._cache.set(product_id, product)
        return product

    def list_active(self):
        return self._store.list_active()

    def update_price(self, product_id, new_price_cents, changed_by):
        """Change a price and record who changed it, in one transaction."""
        self._cache.invalidate(product_id)
        with self._store.transaction() as tx:
            row = tx.execute("SELECT price_cents FROM products WHERE id = ?", (product_id,)).fetchone()
            if row is None:
                raise KeyError(product_id)
            tx.execute("UPDATE products SET price_cents = ? WHERE id = ?", (new_price_cents, product_id))
            tx.execute(
                "INSERT INTO price_audit (product_id, old_cents, new_cents, changed_by) VALUES (?, ?, ?, ?)",
                (product_id, row["price_cents"], new_price_cents, changed_by),
            )

    def discontinue(self, product_id):
        """Take a product off the storefront."""
        with self._store.transaction() as tx:
            cur = tx.execute("UPDATE products SET active = 0 WHERE id = ?", (product_id,))
            if cur.rowcount == 0:
                raise KeyError(product_id)
        self._cache.invalidate(product_id)
