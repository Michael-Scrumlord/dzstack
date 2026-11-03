class SchedkitError(Exception):
    """Base class of everything schedkit raises on purpose."""


class RuleSyntaxError(SchedkitError, ValueError):
    """A rule string could not be parsed."""


class RuleError(SchedkitError):
    """A rule cannot do what was asked (for example, skipping a date of an `every` rule)."""


class JobError(SchedkitError):
    """A job name is taken, unknown, or in the wrong state."""
