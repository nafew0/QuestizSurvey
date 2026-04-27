# Generated for registration IP/subnet tracking.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_remove_sitesettings_ai_api_key_openai_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="registration_ip",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="registration_ip_subnet",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
