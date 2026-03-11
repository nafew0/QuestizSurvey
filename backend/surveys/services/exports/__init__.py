from importlib import import_module

from .common import build_export_context, save_export_file


def __getattr__(name):
    if name == "PDFExportService":
        return import_module("surveys.services.exports.pdf_export").PDFExportService
    if name == "PPTXExportService":
        return import_module("surveys.services.exports.pptx_export").PPTXExportService
    if name == "XLSXExportService":
        return import_module("surveys.services.exports.xlsx_export").XLSXExportService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    "build_export_context",
    "save_export_file",
    "PDFExportService",
    "PPTXExportService",
    "XLSXExportService",
]
