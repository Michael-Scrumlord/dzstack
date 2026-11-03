"""The format registry. Nothing else in reportly lists format names."""
from __future__ import annotations

import importlib
import pkgutil
import re
from typing import Iterable

import reportly.formats
from reportly.errors import PluginError
from reportly.plugins.base import FormatBase

_NAME = re.compile(r"[a-z][a-z0-9_-]*\Z")
_REQUIRED = ("name", "extension", "content_type", "description")

_formats: dict[str, type[FormatBase]] = {}
_discovered = False


def register_format(cls: type[FormatBase]) -> type[FormatBase]:
    """Class decorator: makes the format available under `cls.name`."""
    if not (isinstance(cls, type) and issubclass(cls, FormatBase)):
        raise PluginError(f"{cls!r} is not a FormatBase subclass")
    for attr in _REQUIRED:
        if not isinstance(getattr(cls, attr, None), str) or not getattr(cls, attr):
            raise PluginError(f"format {cls.__name__} must define a non-empty `{attr}`")
    if not _NAME.match(cls.name):
        raise PluginError(f"format name {cls.name!r} must match [a-z][a-z0-9_-]*")
    if not cls.extension.startswith(".") or len(cls.extension) < 2:
        raise PluginError(f"format {cls.name!r}: extension must start with a dot, like '.csv'")
    existing = _formats.get(cls.name)
    if existing is not None and existing is not cls:
        raise PluginError(f"format name {cls.name!r} is already taken by {existing.__module__}.{existing.__name__}")
    _formats[cls.name] = cls
    return cls


def unregister(name: str) -> None:
    """Removes a format (used by tests that register throwaway formats)."""
    _formats.pop(name, None)


def discover() -> None:
    """Imports every module of `reportly.formats`, once, so their decorators run."""
    global _discovered
    if _discovered:
        return
    _discovered = True
    for module in pkgutil.iter_modules(reportly.formats.__path__):
        importlib.import_module(f"reportly.formats.{module.name}")


def load_plugins(modules: Iterable[str]) -> None:
    """Imports the modules named under `[plugins] modules` in the config."""
    for name in modules:
        try:
            importlib.import_module(name)
        except ImportError as exc:
            raise PluginError(f"cannot load plugin module {name!r}: {exc}") from exc


def get_format(name: str) -> type[FormatBase]:
    discover()
    try:
        return _formats[name]
    except KeyError:
        known = ", ".join(sorted(_formats)) or "none"
        raise PluginError(f"unknown format {name!r} (available: {known})") from None


def available_formats() -> list[type[FormatBase]]:
    discover()
    return [_formats[name] for name in sorted(_formats)]
