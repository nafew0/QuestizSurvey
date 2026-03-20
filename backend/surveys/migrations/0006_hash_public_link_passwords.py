from django.contrib.auth.hashers import identify_hasher, make_password
from django.core.exceptions import ValidationError
from django.db import migrations


def _normalize_password_hash(value):
    normalized = (value or "").strip()
    if not normalized:
        return ""

    try:
        identify_hasher(normalized)
    except (TypeError, ValueError, ValidationError):
        return make_password(normalized)
    return normalized


def hash_public_link_passwords(apps, schema_editor):
    for model_name in ("Survey", "Collector"):
        Model = apps.get_model("surveys", model_name)
        for instance in Model.objects.all().iterator():
            settings = dict(instance.settings or {})
            legacy_password = (settings.get("password") or "").strip()
            hashed_password = _normalize_password_hash(
                settings.get("password_hash") or legacy_password
            )

            if not hashed_password:
                continue

            settings["password_hash"] = hashed_password
            settings.pop("password", None)

            instance.settings = settings
            instance.save(update_fields=["settings"])


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0005_aichatsession_aichatmessage_and_more"),
    ]

    operations = [
        migrations.RunPython(
            hash_public_link_passwords,
            migrations.RunPython.noop,
        ),
    ]
