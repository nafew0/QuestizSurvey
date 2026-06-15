import ipaddress

from django.conf import settings

LOOPBACK_PROXY_IPS = ("127.0.0.1", "::1")
TRUSTED_PROXY_HEADERS = (
    "HTTP_X_FORWARDED_FOR",
    "HTTP_X_REAL_IP",
    "HTTP_CF_CONNECTING_IP",
    "HTTP_TRUE_CLIENT_IP",
    "HTTP_X_CLUSTER_CLIENT_IP",
)


def _extract_forwarded_ip(header_value):
    if not header_value:
        return ""

    parts = [part.strip() for part in str(header_value).split(",") if part.strip()]
    return parts[0] if parts else ""


def get_client_ip(request):
    remote_addr = (request.META.get("REMOTE_ADDR") or "").strip()
    trusted_proxy_ips = [
        *(getattr(settings, "TRUSTED_PROXY_IPS", []) or []),
        *LOOPBACK_PROXY_IPS,
    ]

    if remote_addr and ip_matches_allowlist(remote_addr, trusted_proxy_ips):
        for header_name in TRUSTED_PROXY_HEADERS:
            forwarded_ip = _extract_forwarded_ip(request.META.get(header_name))
            if forwarded_ip:
                return forwarded_ip

    return remote_addr


def ip_matches_allowlist(ip_address, allowlist):
    normalized_ip = (ip_address or "").strip()
    if not normalized_ip:
        return False

    try:
        parsed_ip = ipaddress.ip_address(normalized_ip)
    except ValueError:
        return False

    for candidate in allowlist or []:
        normalized_candidate = (candidate or "").strip()
        if not normalized_candidate:
            continue

        try:
            if "/" in normalized_candidate:
                network = ipaddress.ip_network(normalized_candidate, strict=False)
                if parsed_ip in network:
                    return True
            elif parsed_ip == ipaddress.ip_address(normalized_candidate):
                return True
        except ValueError:
            continue

    return False
