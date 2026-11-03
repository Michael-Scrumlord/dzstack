"""Input checks shared by the API and the command line."""
from __future__ import annotations

import re

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE = re.compile(r"^\+?[0-9][0-9 ()-]{5,19}$")
STATUSES = ("active", "suspended", "left")
MAX_NAME_LENGTH = 120
USER_FIELDS = ("full_name", "email", "team_id", "status", "phone")


class ValidationError(ValueError):
    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


def clean_email(value) -> str:
    if not isinstance(value, str):
        raise ValidationError("email", "email must be a string")
    email = value.strip().lower()
    if not EMAIL.match(email):
        raise ValidationError("email", f"{value!r} is not an email address")
    return email


def clean_phone(value):
    """A phone number, or None for 'no phone'."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError("phone", "phone must be a string")
    phone = value.strip()
    if not phone:
        return None
    if not PHONE.match(phone):
        raise ValidationError("phone", f"{value!r} is not a phone number")
    return phone


def clean_status(value) -> str:
    if value not in STATUSES:
        raise ValidationError("status", f"status must be one of {', '.join(STATUSES)}")
    return value


def clean_team_id(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValidationError("team_id", "team_id must be a positive integer or null")
    return value


def clean_full_name(value) -> str:
    if not isinstance(value, str):
        raise ValidationError("full_name", "full_name must be a string")
    name = " ".join(value.split())
    if not name:
        raise ValidationError("full_name", "full_name is required")
    if len(name) > MAX_NAME_LENGTH:
        raise ValidationError("full_name", f"full_name is longer than {MAX_NAME_LENGTH} characters")
    return name


_CLEANERS = {
    "full_name": clean_full_name,
    "email": clean_email,
    "team_id": clean_team_id,
    "status": clean_status,
    "phone": clean_phone,
}


def clean_user_payload(payload, *, partial: bool = False) -> dict:
    """Check a create (all of full_name and email) or update (any of the fields) payload."""
    if not isinstance(payload, dict):
        raise ValidationError("payload", "the body must be an object")
    unknown = sorted(set(payload) - set(USER_FIELDS))
    if unknown:
        raise ValidationError("payload", f"unknown fields: {', '.join(unknown)}")
    required = () if partial else ("full_name", "email")
    for field in required:
        if field not in payload:
            raise ValidationError(field, f"{field} is required")
    if partial and not payload:
        raise ValidationError("payload", "nothing to update")
    return {field: _CLEANERS[field](value) for field, value in payload.items()}


def clean_page(value, default: int, *, name: str, maximum: int | None = None) -> int:
    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValidationError(name, f"{name} must be a whole number") from None
    if number < 1 or (maximum is not None and number > maximum):
        raise ValidationError(name, f"{name} must be between 1 and {maximum or 'infinity'}")
    return number
