class ReportlyError(Exception):
    """Base class. `exit_code` is what the command line exits with when it is not handled."""

    exit_code = 1


class UsageError(ReportlyError):
    exit_code = 2


class ConfigError(UsageError):
    """The config file, an environment variable or a format option is wrong."""


class PluginError(UsageError):
    """A format could not be registered or found."""


class SourceError(ReportlyError):
    """The data could not be read."""


class RowError(ReportlyError):
    """A row does not fit the report's columns."""

    def __init__(self, row_number: int, expected: int, got: int):
        super().__init__(f"row {row_number}: expected {expected} values, got {got}")
        self.row_number = row_number
        self.expected = expected
        self.got = got
