from pathlib import Path

from django.conf import settings
from django.template.loader import render_to_string

from weasyprint import HTML


class PDFExportService:
    def generate(self, survey, analytics_data, config) -> bytes:
        css_path = Path(settings.BASE_DIR) / "surveys" / "static" / "exports" / "report.css"
        css_content = css_path.read_text(encoding="utf-8")

        html = render_to_string(
            "exports/report.html",
            {
                "survey": survey,
                "export": analytics_data,
                "config": config,
                "css_content": css_content,
            },
        )
        return HTML(string=html, base_url=str(settings.BASE_DIR)).write_pdf()
