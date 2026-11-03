_UNITS = ("B", "KB", "MB", "GB", "TB")


def humanize_bytes(count: int) -> str:
    """1536 -> "1.5 KB". Uses 1024-based steps."""
    size = float(count)
    for unit in _UNITS:
        if abs(size) < 1024 or unit == _UNITS[-1]:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    raise AssertionError("unreachable")


def humanize_seconds(seconds: float) -> str:
    if seconds < 1:
        return f"{seconds * 1000:.0f} ms"
    if seconds < 60:
        return f"{seconds:.1f} s"
    minutes, rest = divmod(int(seconds), 60)
    return f"{minutes} min {rest} s"
