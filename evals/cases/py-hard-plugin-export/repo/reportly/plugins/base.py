from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, ClassVar, Iterable, Mapping, Sequence, TextIO

from reportly.columns import Column
from reportly.errors import ConfigError

# A streaming format may hold at most this many rows at a time.
BUFFER_ROWS = 100

_TRUE = ("true", "yes", "on", "1")
_FALSE = ("false", "no", "off", "0")


@dataclass(frozen=True)
class Option:
    """One setting of a format: `[formats.<name>]` in the config, `--option name=value` on the command line."""

    type: type
    default: Any
    help: str = ""
    validate: Callable[[Any], None] | None = None  # raises ValueError with a message

    def convert(self, raw: Any) -> Any:
        if self.type is bool:
            if isinstance(raw, bool):
                value = raw
            elif isinstance(raw, str) and raw.strip().lower() in _TRUE + _FALSE:
                value = raw.strip().lower() in _TRUE
            else:
                raise ValueError(f"expected true or false, got {raw!r}")
        elif self.type is int:
            if isinstance(raw, bool) or not isinstance(raw, (int, str)):
                raise ValueError(f"expected a whole number, got {raw!r}")
            try:
                value = int(raw)
            except ValueError:
                raise ValueError(f"expected a whole number, got {raw!r}") from None
        elif self.type is str:
            if not isinstance(raw, str):
                raise ValueError(f"expected text, got {raw!r}")
            value = raw
        else:
            raise TypeError(f"options of type {self.type.__name__} are not supported")
        if self.validate is not None:
            self.validate(value)
        return value


class FormatBase:
    """Base class of output formats. See docs/plugins.md for the contract."""

    name: ClassVar[str]
    extension: ClassVar[str]
    content_type: ClassVar[str]
    description: ClassVar[str]
    streaming: ClassVar[bool] = False
    options: ClassVar[Mapping[str, Option]] = {}

    def __init__(self, **options: Any):
        unknown = sorted(set(options) - set(self.options))
        if unknown:
            known = ", ".join(sorted(self.options)) or "none"
            raise ConfigError(f"format {self.name!r} has no option {unknown[0]!r} (known options: {known})")
        self.opts: dict[str, Any] = {}
        for key, option in self.options.items():
            try:
                self.opts[key] = option.convert(options.get(key, option.default))
            except ValueError as exc:
                raise ConfigError(f"format {self.name!r}, option {key!r}: {exc}") from None

    def render(self, columns: Sequence[Column], rows: Iterable[Sequence[Any]], out: TextIO) -> None:
        raise NotImplementedError
