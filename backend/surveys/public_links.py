import re


SURVEY_SLUG_MIN_LENGTH = 2
SURVEY_SLUG_MAX_LENGTH = 32
SURVEY_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Root-level survey links share the hostname with the application and infrastructure.
# Keep every protected first path segment here so a survey cannot shadow it.
RESERVED_SURVEY_SLUGS = frozenset(
    {
        "admin",
        "api",
        "assets",
        "audio",
        "branding",
        "dashboard",
        "forgot-password",
        "login",
        "media",
        "payment",
        "pricing",
        "profile",
        "register",
        "reports",
        "reset-password",
        "s",
        "static",
        "surveys",
        "verify-email",
        "ws",
    }
)


def normalize_survey_slug(value):
    return str(value or "").strip().lower()


def validate_survey_slug(value):
    normalized = normalize_survey_slug(value)

    if len(normalized) < SURVEY_SLUG_MIN_LENGTH:
        raise ValueError(
            f"Use at least {SURVEY_SLUG_MIN_LENGTH} characters for the share link."
        )
    if len(normalized) > SURVEY_SLUG_MAX_LENGTH:
        raise ValueError(
            f"Use no more than {SURVEY_SLUG_MAX_LENGTH} characters for the share link."
        )
    if not SURVEY_SLUG_PATTERN.fullmatch(normalized):
        raise ValueError(
            "Use only lowercase letters, numbers, and single hyphens, and start and end with a letter or number."
        )
    if normalized in RESERVED_SURVEY_SLUGS:
        raise ValueError("That share link is reserved. Choose a different one.")

    return normalized
