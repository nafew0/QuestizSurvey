from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse


SURVEY_THEME_FONTS = {
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Merriweather",
}
SURVEY_THEME_BUTTON_STYLES = {"rounded", "square", "pill"}
SURVEY_THEME_LOGO_POSITIONS = {"left", "center", "right"}
SURVEY_THEME_QUESTION_SPACING = {"compact", "comfortable", "spacious"}

DEFAULT_SURVEY_THEME = {
    "primary_color": "#111827",
    "background_color": "#ffffff",
    "text_color": "#111827",
    "font_family": "Inter",
    "button_style": "rounded",
    "progress_bar_color": "#111827",
    "logo_url": "",
    "logo_position": "left",
    "background_image_url": "",
    "background_image_opacity": 0.18,
    "question_spacing": "comfortable",
}


def clamp(value, minimum, maximum):
    return min(maximum, max(minimum, value))


def normalize_hex(value, fallback):
    if not value:
        return fallback

    trimmed = str(value).strip()
    with_hash = trimmed if trimmed.startswith("#") else f"#{trimmed}"

    if len(with_hash) == 4 and all(character in "0123456789abcdefABCDEF" for character in with_hash[1:]):
        return "#" + "".join(character * 2 for character in with_hash[1:]).lower()

    if len(with_hash) == 7 and all(character in "0123456789abcdefABCDEF" for character in with_hash[1:]):
        return with_hash.lower()

    return fallback


def _normalize_opacity(value):
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return DEFAULT_SURVEY_THEME["background_image_opacity"]

    return round(clamp(numeric, 0.0, 1.0), 2)


def normalize_survey_theme(theme=None):
    raw_theme = dict(theme or {})
    primary_color = normalize_hex(
        raw_theme.get("primary_color") or raw_theme.get("primary"),
        DEFAULT_SURVEY_THEME["primary_color"],
    )
    background_color = normalize_hex(
        raw_theme.get("background_color"),
        DEFAULT_SURVEY_THEME["background_color"],
    )
    text_color = normalize_hex(
        raw_theme.get("text_color") or raw_theme.get("accent"),
        DEFAULT_SURVEY_THEME["text_color"],
    )
    progress_bar_color = normalize_hex(
        raw_theme.get("progress_bar_color") or primary_color,
        primary_color,
    )

    font_family = raw_theme.get("font_family") or DEFAULT_SURVEY_THEME["font_family"]
    if font_family not in SURVEY_THEME_FONTS:
        font_family = DEFAULT_SURVEY_THEME["font_family"]

    button_style = raw_theme.get("button_style") or DEFAULT_SURVEY_THEME["button_style"]
    if button_style not in SURVEY_THEME_BUTTON_STYLES:
        button_style = DEFAULT_SURVEY_THEME["button_style"]

    logo_position = raw_theme.get("logo_position") or DEFAULT_SURVEY_THEME["logo_position"]
    if logo_position not in SURVEY_THEME_LOGO_POSITIONS:
        logo_position = DEFAULT_SURVEY_THEME["logo_position"]

    question_spacing = raw_theme.get("question_spacing") or DEFAULT_SURVEY_THEME["question_spacing"]
    if question_spacing not in SURVEY_THEME_QUESTION_SPACING:
        question_spacing = DEFAULT_SURVEY_THEME["question_spacing"]

    return {
        "primary_color": primary_color,
        "background_color": background_color,
        "text_color": text_color,
        "font_family": font_family,
        "button_style": button_style,
        "progress_bar_color": progress_bar_color,
        "logo_url": (raw_theme.get("logo_url") or "").strip(),
        "logo_position": logo_position,
        "background_image_url": (raw_theme.get("background_image_url") or "").strip(),
        "background_image_opacity": _normalize_opacity(
            raw_theme.get("background_image_opacity")
        ),
        "question_spacing": question_spacing,
    }


def get_theme_asset_field(asset_type):
    if asset_type == "logo":
        return "logo_url"
    if asset_type == "background":
        return "background_image_url"
    raise ValueError(f"Unsupported survey theme asset type: {asset_type}")


def get_theme_asset_relative_path(theme_url, media_url):
    if not theme_url:
        return None

    media_prefix = f"/{str(media_url).strip('/')}/"
    parsed = urlparse(theme_url)
    asset_path = parsed.path or str(theme_url)

    if not asset_path.startswith(media_prefix):
        return None

    return asset_path.removeprefix(media_prefix)


def build_uploaded_asset_name(asset_type, filename):
    extension = Path(filename or "").suffix.lower() or ".bin"
    return f"{asset_type}{extension}"
