import os

from django.conf import settings


PROVIDER_ENV_VARS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


def is_database_ai_secret_storage_enabled():
    return bool(getattr(settings, "AI_SECRETS_ALLOW_DATABASE", True))


def get_ai_api_key(settings_obj, provider):
    normalized_provider = (provider or "").strip().lower()
    env_var_name = PROVIDER_ENV_VARS.get(normalized_provider, "")
    env_value = (os.environ.get(env_var_name, "") or "").strip()
    if env_value:
        return env_value

    if not is_database_ai_secret_storage_enabled():
        return ""

    field_name = f"ai_api_key_{normalized_provider}"
    return (getattr(settings_obj, field_name, "") or "").strip()


def get_ai_api_key_meta(settings_obj, provider):
    normalized_provider = (provider or "").strip().lower()
    env_var_name = PROVIDER_ENV_VARS.get(normalized_provider, "")
    env_value = (os.environ.get(env_var_name, "") or "").strip()
    if env_value:
        return {
            "configured": True,
            "value": env_value,
            "source": "environment",
        }

    field_name = f"ai_api_key_{normalized_provider}"
    db_value = (getattr(settings_obj, field_name, "") or "").strip()
    if db_value and is_database_ai_secret_storage_enabled():
        return {
            "configured": True,
            "value": db_value,
            "source": "database",
        }

    return {
        "configured": False,
        "value": "",
        "source": "environment" if not is_database_ai_secret_storage_enabled() else "",
    }
