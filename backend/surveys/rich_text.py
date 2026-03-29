import re
from html import escape
from html.parser import HTMLParser

import bleach
from bleach.css_sanitizer import CSSSanitizer

ALLOWED_RICH_TEXT_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "span",
]
ALLOWED_RICH_TEXT_COLORS = {
    "#0f172a",
    "#2563eb",
    "#059669",
    "#dc2626",
    "#d97706",
    "#7c3aed",
}
ALLOWED_RICH_TEXT_ALIGNMENTS = {"left", "center", "right"}
ALLOWED_RICH_TEXT_STYLES_BY_TAG = {
    "p": {"text-align"},
    "ul": {"text-align"},
    "ol": {"text-align"},
    "li": {"text-align"},
    "span": {"color"},
}
RICH_TEXT_CSS_SANITIZER = CSSSanitizer(
    allowed_css_properties=["color", "text-align"],
)
RICH_TEXT_CLEANER = bleach.Cleaner(
    tags=ALLOWED_RICH_TEXT_TAGS,
    attributes={
        tag: ["style"] for tag in ALLOWED_RICH_TEXT_STYLES_BY_TAG
    },
    strip=True,
    css_sanitizer=RICH_TEXT_CSS_SANITIZER,
)


def _normalize_color(value):
    candidate = (value or "").strip().lower()
    if candidate in ALLOWED_RICH_TEXT_COLORS:
        return candidate

    rgb_match = re.match(
        r"^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$",
        candidate,
    )
    if not rgb_match:
        return None

    channels = [max(0, min(255, int(part))) for part in rgb_match.groups()]
    normalized = "#{:02x}{:02x}{:02x}".format(*channels)
    return normalized if normalized in ALLOWED_RICH_TEXT_COLORS else None


def _normalize_style(tag, style_value):
    allowed_properties = ALLOWED_RICH_TEXT_STYLES_BY_TAG.get(tag, set())
    declarations = []

    for declaration in (style_value or "").split(";"):
        if ":" not in declaration:
            continue

        property_name, raw_value = declaration.split(":", 1)
        property_name = property_name.strip().lower()
        raw_value = raw_value.strip()

        if property_name not in allowed_properties or not raw_value:
            continue

        if property_name == "text-align":
            normalized_value = raw_value.lower()
            if normalized_value not in ALLOWED_RICH_TEXT_ALIGNMENTS:
                continue
            declarations.append(f"text-align: {normalized_value}")
            continue

        if property_name == "color":
            normalized_value = _normalize_color(raw_value)
            if not normalized_value:
                continue
            declarations.append(f"color: {normalized_value}")

    return "; ".join(declarations)


def sanitize_rich_text_html(value):
    raw_html = f"{value or ''}".strip()
    if not raw_html:
        return ""

    cleaned_html = RICH_TEXT_CLEANER.clean(raw_html)
    if not cleaned_html:
        return ""

    def _style_replacer(match):
        tag_name = match.group("tag").lower()
        normalized_style = _normalize_style(tag_name, match.group("style"))
        if not normalized_style:
            return f"<{tag_name}>"
        return f'<{tag_name} style="{normalized_style}">'

    cleaned_html = re.sub(
        r'<(?P<tag>p|ul|ol|li|span)\s+style="(?P<style>[^"]*)">',
        _style_replacer,
        cleaned_html,
        flags=re.IGNORECASE,
    )
    cleaned_html = re.sub(
        r"<(?!/?(?:p|br|strong|em|u|ul|ol|li|span)\b)[^>]+>",
        "",
        cleaned_html,
        flags=re.IGNORECASE,
    )

    return cleaned_html if rich_text_to_plain_text(cleaned_html) else ""


class _RichTextPlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.list_stack = []

    def _append(self, value):
        if value:
            self.parts.append(value)

    def _append_break(self, count=1):
        if not self.parts:
            return

        existing_breaks = 0
        for part in reversed(self.parts):
            if part != "\n":
                break
            existing_breaks += 1

        for _ in range(max(count - existing_breaks, 0)):
            self.parts.append("\n")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "br":
            self._append("\n")
            return

        if tag == "ul":
            self.list_stack.append(("ul", 0))
            return

        if tag == "ol":
            self.list_stack.append(("ol", 0))
            return

        if tag == "li":
            if self.parts and self.parts[-1] not in {"\n", " "}:
                self._append("\n")

            if self.list_stack:
                list_type, count = self.list_stack[-1]
                count += 1
                self.list_stack[-1] = (list_type, count)
                prefix = f"{count}. " if list_type == "ol" else "• "
            else:
                prefix = "• "

            self._append(prefix)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "li":
            self._append("\n")
            return

        if tag in {"p", "ul", "ol"}:
            self._append_break(2 if tag == "p" else 1)

        if tag in {"ul", "ol"} and self.list_stack:
            self.list_stack.pop()

    def handle_data(self, data):
        self._append(data)


def rich_text_to_plain_text(value):
    sanitized_html = f"{value or ''}".strip()
    if not sanitized_html:
        return ""

    parser = _RichTextPlainTextParser()
    parser.feed(sanitized_html)
    parser.close()

    plain_text = "".join(parser.parts)
    plain_text = plain_text.replace("\xa0", " ")
    plain_text = re.sub(r"[ \t]+\n", "\n", plain_text)
    plain_text = re.sub(r"\n[ \t]+", "\n", plain_text)
    plain_text = re.sub(r"\n{3,}", "\n\n", plain_text)
    return plain_text.strip()


def plain_text_to_rich_text_html(value):
    raw_text = f"{value or ''}".replace("\r\n", "\n").strip()
    if not raw_text:
        return ""

    paragraphs = [
        f"<p>{escape(paragraph).replace(chr(10), '<br>')}</p>"
        for paragraph in re.split(r"\n{2,}", raw_text)
        if paragraph.strip()
    ]
    return "".join(paragraphs)
