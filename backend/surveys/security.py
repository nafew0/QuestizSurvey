from __future__ import annotations

from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.core.exceptions import ValidationError

PASSWORD_LEGACY_KEY = "password"
PASSWORD_HASH_KEY = "password_hash"
PASSWORD_CONFIGURED_KEY = "password_configured"


def _normalize_secret(value):
    return (value or "").strip()


def _get_legacy_password(settings):
    return _normalize_secret((settings or {}).get(PASSWORD_LEGACY_KEY))


def get_public_link_password_hash(settings):
    hashed_value = _normalize_secret((settings or {}).get(PASSWORD_HASH_KEY))
    if hashed_value:
        return hashed_value

    legacy_value = _get_legacy_password(settings)
    if not legacy_value:
        return ""

    try:
        identify_hasher(legacy_value)
    except (TypeError, ValueError, ValidationError):
        return ""
    return legacy_value


def has_public_link_password(settings):
    return bool(get_public_link_password_hash(settings) or _get_legacy_password(settings))


def check_public_link_password(settings, raw_password):
    normalized_password = _normalize_secret(raw_password)
    if not has_public_link_password(settings):
        return True
    if not normalized_password:
        return False

    hashed_value = get_public_link_password_hash(settings)
    if hashed_value:
        return check_password(normalized_password, hashed_value)

    return normalized_password == _get_legacy_password(settings)


def sanitize_access_settings(settings):
    sanitized = dict(settings or {})
    password_enabled = bool(sanitized.get("password_enabled"))
    password_configured = has_public_link_password(sanitized)

    sanitized.pop(PASSWORD_HASH_KEY, None)
    sanitized.pop(PASSWORD_LEGACY_KEY, None)

    if password_enabled:
        sanitized[PASSWORD_LEGACY_KEY] = ""
        sanitized[PASSWORD_CONFIGURED_KEY] = password_configured
    else:
        sanitized.pop(PASSWORD_CONFIGURED_KEY, None)

    return sanitized


def normalize_access_settings(settings, *, existing_settings=None):
    incoming_settings = dict(settings or {})
    normalized_settings = dict(existing_settings or {})
    normalized_settings.update(incoming_settings)

    password_enabled = bool(normalized_settings.get("password_enabled"))
    incoming_includes_password = PASSWORD_LEGACY_KEY in incoming_settings
    incoming_password = _normalize_secret(incoming_settings.get(PASSWORD_LEGACY_KEY))
    existing_hash = get_public_link_password_hash(existing_settings)
    existing_legacy_password = _get_legacy_password(existing_settings)

    if not password_enabled:
        normalized_settings.pop(PASSWORD_HASH_KEY, None)
        normalized_settings.pop(PASSWORD_LEGACY_KEY, None)
        normalized_settings.pop(PASSWORD_CONFIGURED_KEY, None)
        return normalized_settings

    if incoming_includes_password:
        if incoming_password:
            normalized_settings[PASSWORD_HASH_KEY] = make_password(incoming_password)
        elif existing_hash:
            normalized_settings[PASSWORD_HASH_KEY] = existing_hash
        elif existing_legacy_password:
            normalized_settings[PASSWORD_HASH_KEY] = make_password(existing_legacy_password)
        else:
            raise ValueError("A password is required when enabling password protection.")
    elif existing_hash:
        normalized_settings[PASSWORD_HASH_KEY] = existing_hash
    elif existing_legacy_password:
        normalized_settings[PASSWORD_HASH_KEY] = make_password(existing_legacy_password)
    else:
        raise ValueError("A password is required when enabling password protection.")

    normalized_settings.pop(PASSWORD_LEGACY_KEY, None)
    normalized_settings.pop(PASSWORD_CONFIGURED_KEY, None)
    return normalized_settings
