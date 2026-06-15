import ipaddress

from django.conf import settings

MAX_REGISTRATIONS_PER_SUBNET = 50
IPV4_PREFIX_LENGTH = 24
IPV6_PREFIX_LENGTH = 64


def compute_registration_subnet(ip_address):
    """Return the canonical subnet string for an IP, or "" if invalid."""
    if not ip_address:
        return ""
    try:
        parsed = ipaddress.ip_address(ip_address.strip())
    except ValueError:
        return ""

    prefix = IPV4_PREFIX_LENGTH if parsed.version == 4 else IPV6_PREFIX_LENGTH
    network = ipaddress.ip_network(f"{parsed}/{prefix}", strict=False)
    return str(network)


def has_subnet_reached_registration_cap(subnet):
    """True if the subnet has already produced MAX_REGISTRATIONS_PER_SUBNET accounts."""
    if not subnet:
        return False

    from .models import User

    limit = getattr(
        settings,
        "ACCOUNT_REGISTRATION_SUBNET_LIMIT",
        MAX_REGISTRATIONS_PER_SUBNET,
    )
    count = User.objects.filter(registration_ip_subnet=subnet).count()
    return count >= limit
