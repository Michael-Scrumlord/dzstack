class BillingError(Exception):
    """Base class for everything this package raises on purpose."""


class DocumentError(BillingError):
    """The invoice document is not valid: wrong shape, bad value or an unknown field."""


class StoreError(BillingError):
    """The invoice store cannot do what was asked (missing invoice, number already used)."""
