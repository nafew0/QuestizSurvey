# Production Security Audit

Date: 2026-03-20

## Scope

Full-stack security audit of the Questiz survey application covering:

- Django REST Framework backend (authentication, authorization, API endpoints, data storage)
- React frontend (token management, XSS, open redirects, input handling)
- Payment integrations (Stripe, bKash)
- AI service integrations (OpenAI, Anthropic)
- Production deployment configuration

## Previously Reported Items Now Resolved

These were flagged in the initial audit and have been addressed:

- **JWT tokens moved out of localStorage.** Access token is now held in a JavaScript closure (`inMemoryAccessToken` in `api.js:3`). Refresh token is stored in an HttpOnly cookie via `set_refresh_cookie()` in `accounts/token_cookies.py`.
- **Login and registration endpoints are now throttled.** `LoginRateThrottle` at 10/min and `RegisterRateThrottle` at 5/hour are applied (`accounts/throttles.py:15-44`, `accounts/views.py:107,140`).
- **Production settings now fail-closed.** `ImproperlyConfigured` is raised if `DJANGO_SECRET_KEY` is the default or `DEBUG=True` in production (`settings.py:331-337`). HSTS, SSL redirect, `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options: DENY` are all enabled in the production branch (`settings.py:339-351`).
- **Survey link passwords are now hashed.** `surveys/security.py` uses `make_password()`/`check_password()` for survey access passwords. Legacy plaintext values are handled via a migration path (`security.py:39-50,87-105`).
- **Password reset validation no longer leaks PII.** `PasswordResetValidateView` now returns only `{"valid": true}` (`password_reset_views.py:76-81`).
- **`.env` file is gitignored and was never committed** (`backend/.gitignore:35`).

---

## Remaining Findings

### 1. High: Open redirect via `redirect` query parameter

**Files:**
- `frontend/src/pages/Login.jsx:22,67`
- `frontend/src/pages/Register.jsx:25` (same pattern)

**Issue:**
The `redirect` parameter from the URL query string is passed directly to `navigate()` without validation:
```javascript
const redirectTo = searchParams.get('redirect') || '/dashboard'
// ...
navigate(redirectTo)
```
An attacker can craft a URL like `/login?redirect=https://evil.com` or `/login?redirect=//evil.com` to redirect users to a malicious site after successful authentication.

**Impact:**
Phishing attacks. A user trusts the legitimate login page, enters real credentials, then is silently redirected to an attacker-controlled page that can harvest additional information or serve malware.

**Fix:**
Validate that the redirect target is a relative path on the same origin:
```javascript
function getSafeRedirect(value) {
  const target = (value || '').trim()
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    return target
  }
  return '/dashboard'
}

const redirectTo = getSafeRedirect(searchParams.get('redirect'))
```
Apply the same validation in both `Login.jsx` and `Register.jsx`.

---

### 2. High: `is_staff` and `is_superuser` exposed in the user serializer

**File:** `backend/accounts/serializers.py:24-25`

**Issue:**
`UserSerializer` includes `is_staff` and `is_superuser` in the response for all authenticated users:
```python
fields = [
    "id", "username", "email",
    "is_staff", "is_superuser",  # <-- exposed to every authenticated user
    ...
]
```
This serializer is used in login, registration, profile fetch, and profile update responses. Every authenticated user receives this data, including their own admin status flags.

**Impact:**
Attackers can enumerate which accounts are admin/superuser accounts. This assists targeted attacks against privileged accounts. It also leaks internal role architecture.

**Fix:**
Remove `is_staff` and `is_superuser` from `UserSerializer.fields`. If the frontend needs to know admin status, create a separate admin-only serializer or add a computed `role` field that the frontend checks:
```python
fields = [
    "id", "username", "email",
    "first_name", "last_name", "bio", "avatar",
    "organization", "designation", "phone",
    "email_verified", "current_plan",
    "created_at", "updated_at",
]
```
If the frontend genuinely needs `is_superuser` for conditional rendering (admin panel link), keep it but remove `is_staff`.

---

### 3. High: No rate limiting on public survey response submission

**File:** `backend/surveys/views/response_views.py:87-88`

**Issue:**
`PublicSurveyView` accepts `POST` (new response) and `PUT` (update response) from anonymous users with `permission_classes = [AllowAny]` and no `throttle_classes`. The existing duplicate-prevention only checks IP or user after a completed response, meaning an attacker can submit thousands of in-progress responses unthrottled.

**Impact:**
- Survey response flooding / data pollution
- Database storage exhaustion (each response creates rows in `SurveyResponse` + `Answer` tables)
- Denial of service against the survey owner's response quota

**Fix:**
Add a throttle class to `PublicSurveyView`:
```python
from rest_framework.throttling import AnonRateThrottle

class PublicSurveyResponseThrottle(AnonRateThrottle):
    scope = 'public_survey_response'
    rate = '30/hour'

class PublicSurveyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PublicSurveyResponseThrottle]
```

---

### 4. High: X-Forwarded-For header trusted without proxy validation

**Files:**
- `backend/surveys/views/response_views.py:513-517`
- `backend/accounts/verification.py:134-138` (same pattern)

**Issue:**
```python
def _get_client_ip(self, request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
```
`X-Forwarded-For` is a client-settable header. Without verifying that the request came through a trusted reverse proxy, any client can spoof their IP address. This IP is used for:
- Duplicate response prevention (survey responses)
- Rate limiting cache keys in `LoginRateThrottle` and `RegisterRateThrottle`
- Public resend and password reset throttling

**Impact:**
All IP-based security controls are bypassable. An attacker using Burp Suite can add `X-Forwarded-For: <random-ip>` to every request to evade rate limits and submit unlimited responses.

**Fix:**
Use a library like `django-ipware` that supports trusted proxy configuration, or validate the header only when the request comes from a known proxy:
```python
# settings.py
TRUSTED_PROXY_IPS = env_list("TRUSTED_PROXY_IPS", [])

# utility
def get_client_ip(request):
    if TRUSTED_PROXY_IPS:
        remote_addr = request.META.get("REMOTE_ADDR", "")
        if remote_addr in TRUSTED_PROXY_IPS:
            forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
            if forwarded_for:
                return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")
```

---

### 5. High: AI API keys stored as plaintext in the database

**File:** `backend/accounts/models.py:71-72`

**Issue:**
```python
ai_api_key_openai = models.CharField(max_length=255, blank=True, default="")
ai_api_key_anthropic = models.CharField(max_length=255, blank=True, default="")
```
These fields store real API keys as plain `CharField`. The `AI_SECRETS_ALLOW_DATABASE` setting (`settings.py:329`) disables database storage in production, but the fields still exist and could be populated by an admin accidentally or programmatically.

**Impact:**
A database breach, backup exposure, admin SQL access, or future SQL injection vulnerability would immediately compromise all stored AI provider credentials, leading to unauthorized API usage and potential financial liability.

**Fix:**
- Encrypt these fields at rest using `django-fernet-fields` or `django-encrypted-model-fields`
- Alternatively, remove the fields entirely and require environment-variable-only configuration in production
- If keeping database storage, add a data migration to encrypt existing values

---

### 6. Medium-High: No Content Security Policy header

**File:** `backend/questizsurvey/settings.py` (absent)

**Issue:**
No `Content-Security-Policy` header is configured anywhere in the application. While `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` are set, CSP is the primary defense-in-depth against XSS.

**Impact:**
If an XSS vulnerability exists (see findings 8 and 9), there is no browser-level mitigation to prevent execution of injected scripts. Without CSP, inline scripts, eval(), and loading scripts from arbitrary origins are all permitted.

**Fix:**
Add CSP via Django middleware (`django-csp` package) or a custom middleware:
```python
# Install: pip install django-csp
# settings.py
MIDDLEWARE = [
    ...
    "csp.middleware.CSPMiddleware",
]
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'",)
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_CONNECT_SRC = ("'self'",)
CSP_FONT_SRC = ("'self'",)
CSP_FRAME_ANCESTORS = ("'none'",)
```

---

### 7. Medium-High: Account enumeration via email verification response

**File:** `backend/accounts/views.py:167-171`

**Issue:**
When a user attempts to log in with valid credentials but an unverified email, the server returns a distinct `403` response:
```python
if is_email_verification_required() and not user.email_verified:
    return Response(
        build_verification_required_response(user),
        status=status.HTTP_403_FORBIDDEN,
    )
```
This is a different response (403) from the invalid credentials case (401). An attacker can distinguish between:
- Account does not exist or wrong password: `401`
- Account exists with unverified email: `403`

**Impact:**
Confirms account existence. Combined with the `email_hint` field (masked email), provides partial email disclosure.

**Fix:**
Return the same `401` status for all failed login scenarios. If email verification guidance is needed, include it in the generic error without changing the status code:
```python
if is_email_verification_required() and not user.email_verified:
    return Response(
        {"detail": "No active account found with the given credentials."},
        status=status.HTTP_401_UNAUTHORIZED,
    )
```
Alternatively, if you want to keep the UX of prompting verification, accept the enumeration trade-off but document it as a deliberate design choice.

---

### 8. Medium: `innerHTML` injection in embed code builder

**File:** `frontend/src/pages/surveys/SurveyDistributePage.jsx:145-163`

**Issue:**
The `buildPopupEmbedCode()` function constructs HTML using template literals with `publicUrl` interpolated into an `innerHTML` assignment:
```javascript
overlay.innerHTML = '...<iframe src="${publicUrl}" ...></iframe>...'
```
While `publicUrl` is currently derived from `window.location.origin + '/s/' + survey.slug`, the slug is user-defined content. If a survey slug could contain characters like `"` or `>`, the embed code could break or inject HTML.

**Impact:**
Low direct risk since slugs are likely sanitized server-side, but the pattern is unsafe. Users copy this embed code into their own websites, making it a vector for stored XSS on third-party sites if slug sanitization is ever weakened.

**Fix:**
Use DOM APIs instead of `innerHTML`, or HTML-encode the URL before interpolation:
```javascript
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

---

### 9. Medium: `document.write()` with unsanitized survey title

**File:** `frontend/src/pages/surveys/SurveyDistributePage.jsx:501-510`

**Issue:**
```javascript
printWindow.document.write(`
  <html>
    <head><title>${survey.title}</title></head>
    <body>
      <h1>${survey.title}</h1>
      <p>${publicUrl}</p>
      ${qrRef.current?.innerHTML || ''}
    </body>
  </html>
`)
```
`survey.title` is user-supplied content injected directly into a `document.write()` call without escaping. If a survey title contains `<script>alert(1)</script>`, it executes in the print window context.

**Impact:**
Self-XSS for the survey owner (they control the title). Low severity since the victim is the same user, but could be exploited if an attacker creates a survey and tricks an admin into printing the QR code.

**Fix:**
HTML-escape `survey.title` before interpolation, or use DOM methods on the print window.

---

### 10. Medium: No rate limiting on payment endpoints

**Files:**
- `backend/subscriptions/stripe_views.py:21-78` (`StripeCheckoutView`)
- `backend/subscriptions/bkash_views.py:43-150` (`BkashCheckoutView`)

**Issue:**
Both payment checkout views require authentication but have no throttle classes. A compromised or malicious authenticated user could create checkout sessions at an unlimited rate.

**Impact:**
- Stripe/bKash API rate limit exhaustion affecting all users
- Potential for payment gateway abuse or cost amplification
- Resource exhaustion on the server processing payment sessions

**Fix:**
```python
from rest_framework.throttling import UserRateThrottle

class PaymentCheckoutThrottle(UserRateThrottle):
    scope = 'payment_checkout'
    rate = '10/hour'
```
Apply to both `StripeCheckoutView` and `BkashCheckoutView`.

---

### 11. Medium: bKash callback lacks origin verification

**File:** `backend/subscriptions/bkash_views.py:153-196`

**Issue:**
`bkash_callback_view` is a plain Django view (no CSRF, no authentication) that accepts `paymentID` and `status` from GET parameters. There is no verification that the callback originated from bKash infrastructure:
```python
def bkash_callback_view(request):
    payment_id = (request.GET.get("paymentID") or "").strip()
    status_value = (request.GET.get("status") or "").strip().lower()
```
The subsequent `sync_transaction` calls `BkashService` to verify with bKash's API, which provides some protection. However, any unauthenticated request can trigger API calls to bKash and database lookups.

**Impact:**
- Unauthenticated users can trigger bKash API calls (potential rate limit / cost issues)
- Transaction status could be manipulated if bKash verification has edge cases
- Resource exhaustion via repeated callback requests with random payment IDs

**Fix:**
- Add IP allowlisting for bKash callback IPs if bKash documents them
- Add rate limiting to the callback endpoint
- Validate the callback request signature if bKash provides one

---

### 12. Medium: No audit logging for security-sensitive operations

**Files:** Multiple view files across the application

**Issue:**
The following security-critical operations produce no audit log entries:
- Successful and failed login attempts (only rate limiting, no logging)
- Password changes (`accounts/views.py:394-405`)
- Account deletion (`accounts/views.py:408-420`)
- Admin operations (user management, settings changes)
- Payment transactions
- AI API key modifications

**Impact:**
Inability to detect or investigate security incidents. No forensic trail for unauthorized access, credential stuffing, or privilege escalation attempts.

**Fix:**
Add structured logging for all security events:
```python
import logging
audit_logger = logging.getLogger('audit')

# In login_view after successful auth:
audit_logger.info("login_success", extra={
    "user_id": str(user.id),
    "ip": get_request_ip_address(request),
})

# In login_view after failed auth:
audit_logger.warning("login_failure", extra={
    "identifier": identifier,
    "ip": get_request_ip_address(request),
    "reason": "invalid_credentials",
})
```

---

### 13. Medium: Completion cookie missing `Secure` flag

**Files:**
- `backend/surveys/views/response_views.py:299-306`
- `frontend/src/utils/publicSurvey.js:116`

**Issue:**
Backend sets the completion cookie without the `Secure` flag:
```python
response.set_cookie(
    key=f"questiz_responded_{survey_slug}",
    value="true",
    max_age=self.completion_cookie_days * 24 * 60 * 60,
    samesite="Lax",
)
```
Frontend similarly:
```javascript
document.cookie = `${getRespondedCookieName(slug)}=true; expires=${expires}; path=/; SameSite=Lax`
```
Neither includes `Secure`, so the cookie transmits over HTTP.

**Impact:**
Low direct security impact since this cookie only marks "survey already responded" (no secrets). However, missing `Secure` is a bad practice and can be flagged by security scanners. Over HTTP, the cookie value could be observed and manipulated via MITM to bypass duplicate response prevention.

**Fix:**
Backend:
```python
response.set_cookie(
    key=f"questiz_responded_{survey_slug}",
    value="true",
    max_age=self.completion_cookie_days * 24 * 60 * 60,
    samesite="Lax",
    secure=not settings.DEBUG,
)
```
Frontend: Only set the cookie from the backend (server-side), or conditionally add `Secure` when on HTTPS:
```javascript
const securePart = window.location.protocol === 'https:' ? '; Secure' : ''
document.cookie = `${name}=true; expires=${expires}; path=/; SameSite=Lax${securePart}`
```

---

### 14. Medium: No rate limiting on admin endpoints

**File:** `backend/accounts/admin_views.py:38-42`

**Issue:**
All admin views use `IsSuperuserPermission` for authorization but no throttle classes. While admin endpoints require authentication + superuser status, a compromised admin session has unrestricted request rates.

**Impact:**
A compromised admin account could exfiltrate data (user lists, payment records, settings) at full speed with no throttle-based detection.

**Fix:**
```python
class AdminView(APIView):
    permission_classes = [IsSuperuserPermission]
    throttle_classes = [UserRateThrottle]  # e.g., 100/hour
```

---

### 15. Low-Medium: Avatar upload does not strip EXIF metadata

**File:** `backend/accounts/serializers.py:116-153`

**Issue:**
Avatar validation checks file type, size, extension, and MIME type (good), and verifies it's a valid image via PIL (good). However, it does not strip EXIF metadata before storage.

**Impact:**
Uploaded photos may contain GPS coordinates, camera model, timestamps, and other metadata. When avatars are served publicly, this metadata is exposed to other users, creating a privacy leak.

**Fix:**
```python
from PIL import Image
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile

def strip_exif(uploaded_file):
    image = Image.open(uploaded_file)
    data = image.getdata()
    clean_image = Image.new(image.mode, image.size)
    clean_image.putdata(list(data))
    buffer = BytesIO()
    clean_image.save(buffer, format=image.format or 'PNG')
    buffer.seek(0)
    return InMemoryUploadedFile(
        buffer, uploaded_file.field_name, uploaded_file.name,
        uploaded_file.content_type, buffer.getbuffer().nbytes, None
    )
```

---

### 16. Low-Medium: AI debug logging can expose sensitive survey data

**File:** `backend/surveys/services/ai_service.py` (debug logging methods)

**Issue:**
When `AI_DEBUG_LOGGING` is enabled, the AI service logs full prompts and responses including survey content, respondent answers, and AI-generated analysis. This data may contain PII from survey respondents.

**Impact:**
Sensitive survey data (potentially including health information, financial data, personal opinions) can end up in application logs. If logs are shipped to a third-party service or stored without encryption, this constitutes a data leak.

**Fix:**
- Ensure `AI_DEBUG_LOGGING` defaults to `False` and is never enabled in production
- Truncate logged prompts to first 200 characters
- Never log full response payloads
- Add a log filter that redacts email addresses and other PII patterns

---

### 17. Low: HSTS preload not enabled

**File:** `backend/questizsurvey/settings.py:345`

**Issue:**
```python
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
```
HSTS preload is disabled by default. Without preload, the very first request to the domain (before HSTS header is received) is vulnerable to downgrade attacks.

**Impact:**
First-visit MITM attack window. Low probability but relevant for high-security deployments.

**Fix:**
After confirming HTTPS works correctly on all subdomains, set `SECURE_HSTS_PRELOAD=True` and submit the domain to the HSTS preload list at `hstspreload.org`.

---

## Positive Security Measures in Place

These areas are properly secured and did not produce findings:

- **ORM-only database access.** No raw SQL queries found anywhere in the codebase.
- **UUID primary keys** for users and surveys prevent sequential ID enumeration.
- **Refresh token rotation and blacklisting** enabled via SimpleJWT (`settings.py:235-236`).
- **Password hashing** uses Django's default PBKDF2 via `set_password()`/`check_password()`.
- **CSRF middleware** is active. Webhook endpoints use `@csrf_exempt` only where necessary (Stripe).
- **Stripe webhook signature verification** is implemented (`stripe_views.py:109-112`).
- **Survey ownership validation** enforced via `get_owned_survey()` helper on all owner-facing endpoints.
- **Generic responses** on password reset and email resend endpoints prevent account enumeration on those paths.
- **Token blacklisting on password reset** revokes all outstanding refresh tokens (`password_reset_views.py:27-29,104`).
- **Read-only fields** properly configured on serializers to prevent mass assignment.
- **Session cookie HttpOnly** is enabled (`settings.py:322`).
- **Production fail-closed** configuration prevents deployment with insecure defaults.
- **SafeMarkdown component** (`frontend/src/components/analytics/SafeMarkdown.jsx`) avoids `dangerouslySetInnerHTML`.
- **Protected and admin routes** properly gate frontend pages behind authentication and role checks.

---

## Recommended Remediation Order

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | Open redirect in Login/Register (#1) | Small - add a validation function |
| 2 | X-Forwarded-For spoofing (#4) | Small - add trusted proxy config |
| 3 | Public survey response rate limiting (#3) | Small - add throttle class |
| 4 | Remove `is_staff`/`is_superuser` from serializer (#2) | Small - remove two fields |
| 5 | Payment endpoint rate limiting (#10) | Small - add throttle class |
| 6 | Account enumeration via 403 (#7) | Small - change status code |
| 7 | Content Security Policy (#6) | Medium - install django-csp, configure |
| 8 | AI API key encryption (#5) | Medium - add encrypted fields, migration |
| 9 | Audit logging (#12) | Medium - add structured logging |
| 10 | bKash callback hardening (#11) | Medium - add rate limit, IP allowlist |
| 11 | Embed code HTML escaping (#8, #9) | Small - escape interpolated values |
| 12 | Completion cookie Secure flag (#13) | Small - add flag |
| 13 | Admin endpoint rate limiting (#14) | Small - add throttle class |
| 14 | Avatar EXIF stripping (#15) | Small - strip metadata |
| 15 | AI debug log safety (#16) | Small - add truncation/redaction |
| 16 | HSTS preload (#17) | Small - flip flag after HTTPS confirmed |

## Recommended Automated Security Tests

| Test | Tool | Target |
|------|------|--------|
| Brute-force login | Burp Intruder | `POST /api/auth/login/` with spoofed `X-Forwarded-For` |
| Survey response flood | Burp Repeater | `POST /api/public/surveys/{slug}/` at 100 req/s |
| Open redirect | Browser | `/login?redirect=//evil.com`, `/login?redirect=https://evil.com` |
| IDOR on surveys | Burp Repeater | `GET /api/surveys/{other-users-uuid}/` |
| JWT algorithm confusion | jwt_tool | Send token with `alg: none` |
| IP spoofing bypass | Burp Repeater | Add `X-Forwarded-For: 1.2.3.4` to bypass rate limits |
| Admin endpoint access | Burp Repeater | Hit `/api/admin/*` with regular user token |
| XSS in survey title | Browser | Create survey with title `<script>alert(1)</script>`, print QR code |
| Dependency vulnerabilities | `npm audit` / `pip audit` | Frontend and backend dependencies |
| Django deploy check | `python manage.py check --deploy` | Backend settings validation |
| Static analysis | `bandit -r backend/` | Python security linting |
