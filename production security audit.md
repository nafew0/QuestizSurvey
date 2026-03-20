# Production Security Audit

Date: 2026-03-20

## Scope

Reviewed the Questiz backend and frontend with emphasis on:

- user authentication and session handling
- survey public access controls and response privacy
- AI provider secret handling
- payment and registration flows
- production deployment hardening

## Prioritized Findings

### 1. High: Public survey link passwords are stored in plaintext and verified with raw string equality

Evidence:

- `backend/surveys/views/response_views.py:210-223` reads `settings["password"]` and compares it directly with `access_key`.
- `backend/surveys/tests/test_distribution.py:156-169` shows the current expected storage format as plain JSON settings: `"password": "secret123"`.

Impact:

- Any database reader, admin export, backup restore, or accidental log/serializer exposure reveals live survey passwords in cleartext.
- The current design provides no safe at-rest protection for survey link secrets.

Recommended fix:

- Stop storing raw survey passwords in `survey.settings` / `collector.settings`.
- Introduce dedicated helpers such as `set_public_link_password()` and `check_public_link_password()` backed by Django password hashing.
- Store only a hash plus a boolean flag such as `password_enabled`.
- Add a data migration that hashes existing live survey passwords.
- Ensure owner-facing APIs never echo the raw password back after save.

### 2. High: Sensitive survey and report secrets are transmitted in URLs

Evidence:

- `backend/surveys/views/response_views.py:168-173` accepts survey `access_key` from `request.query_params`.
- `backend/surveys/views/response_views.py:298-317` accepts `invite` and `resume_token` from the query string and uses `resume_token` to load an in-progress response.
- `backend/surveys/views/report_views.py:41-50` accepts shared report passwords from `request.query_params`.
- `frontend/src/services/publicSurveys.js:17-24` sends `access_key` on the URL for public survey fetches.
- `frontend/src/services/analytics.js:114-117` sends shared report passwords as URL query params.
- `frontend/src/pages/surveys/PublicSurveyPage.jsx:307-317` persists the resume token into the browser URL.

Impact:

- Query-string secrets are exposed to browser history, reverse-proxy logs, CDN logs, analytics tools, screenshots, and potentially `Referer` headers.
- `resume_token` leakage is especially sensitive because it can reopen in-progress survey responses and expose respondent data.

Recommended fix:

- Move survey unlock and report unlock to POST-only flows with the secret in the request body.
- Treat `resume_token` as a bearer secret and avoid persisting it in the visible URL after use.
- Store unlocked state server-side in a short-lived session or return a short-lived signed nonce instead of reusing raw secrets in URLs.
- Strip any secret-bearing query params from the browser address bar immediately after a successful unlock.

### 3. High: Access and refresh JWTs are stored in `localStorage`

Evidence:

- `frontend/src/contexts/AuthContext.jsx:20-46` initializes auth state from `localStorage`.
- `frontend/src/contexts/AuthContext.jsx:88-90` stores login tokens in `localStorage`.
- `frontend/src/contexts/AuthContext.jsx:120-122` stores registration tokens in `localStorage`.
- `frontend/src/services/api.js:51-53` reads the access token from `localStorage` for the `Authorization` header.
- `frontend/src/services/api.js:74-99` reads the refresh token from `localStorage` and rewrites tokens there during refresh.

Impact:

- Any XSS, compromised third-party script, or injected browser extension can steal both access and refresh tokens.
- Because the refresh token is also script-readable, an attacker can silently maintain account access beyond the access-token lifetime.

Recommended fix:

- Move auth tokens to `HttpOnly`, `Secure`, `SameSite` cookies.
- Keep the refresh token cookie-only and rotate it on refresh.
- If cookie auth is adopted, add CSRF protection appropriate for your frontend architecture.
- Treat `localStorage` as unsuitable for long-lived bearer tokens in production.

### 4. High: Django production settings fail open

Evidence:

- `backend/questizsurvey/settings.py:51-57` defaults to `DJANGO_SECRET_KEY="django-insecure-CHANGE-THIS-IN-PRODUCTION"` and `DEBUG=True`.
- `backend/questizsurvey/settings.py:303-306` only sets secure-cookie flags and proxy header handling.
- No `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_REFERRER_POLICY`, or similar fail-closed production settings were found in `backend/questizsurvey/settings.py`.

Impact:

- A misconfigured deployment can start with a predictable signing key or with Django debug mode enabled.
- Missing transport and browser hardening settings weaken TLS enforcement and increase accidental data leakage risk.

Recommended fix:

- Make production startup fail if `DJANGO_SECRET_KEY` is missing or if `DEBUG=True`.
- Add explicit production-only settings for `SECURE_SSL_REDIRECT`, HSTS, `SECURE_REFERRER_POLICY`, `SECURE_CONTENT_TYPE_NOSNIFF`, and explicit `SESSION_COOKIE_HTTPONLY`.
- Gate the fail-closed behavior on an environment flag such as `ENV=production` or equivalent deployment mode.

### 5. Medium-High: AI provider secrets are stored in plaintext in the application database

Evidence:

- `backend/accounts/models.py:64-72` stores `ai_api_key_openai` and `ai_api_key_anthropic` as plain `CharField`s.
- `backend/accounts/admin_views.py:363-375` persists raw admin-supplied AI keys directly to the database.
- `backend/surveys/services/ai_service.py:57-86` reads those DB values as live provider credentials.

Impact:

- Database access, backups, admin dumps, or future SQL injection would immediately expose OpenAI/Anthropic credentials.
- Secrets stored in the app database are harder to rotate, audit, and centralize than secrets kept in a proper secret store.

Recommended fix:

- Prefer environment variables or a managed secret store for production AI keys.
- If runtime admin-managed keys are required, encrypt them at rest with an application master key or KMS-backed field encryption.
- Restrict who can modify AI settings, log all key changes, and document a rotation process.

### 6. Medium: Login and registration endpoints have no brute-force or abuse throttling

Evidence:

- `backend/accounts/views.py:91-128` exposes registration publicly without any endpoint throttle.
- `backend/accounts/views.py:131-178` exposes login publicly without any endpoint throttle.
- `backend/questizsurvey/settings.py:207-214` defines no DRF default throttle classes or rates.
- By contrast, public resend and password reset already include abuse controls in `backend/accounts/views.py:285-308` and `backend/accounts/password_reset_views.py:43-58`.

Impact:

- The application is currently relying on upstream infrastructure alone to slow credential stuffing, password guessing, and account-creation abuse.
- Registration can also be abused for email-based nuisance traffic if verification is enabled.

Recommended fix:

- Add DRF scoped throttles or a package such as `django-axes` for login and registration.
- Rate-limit by both IP and account identifier where possible.
- Add reverse-proxy or WAF rate limits as a second layer and alert on repeated failures.

### 7. Medium-Low: Password reset validation reveals full account identity

Evidence:

- `backend/accounts/password_reset_views.py:64-83` returns `username` and `email` when a reset token is valid.

Impact:

- Anyone holding a reset link can fetch full account identity details before performing the reset.
- This is unnecessary PII disclosure on a public endpoint.

Recommended fix:

- Return only `{ "valid": true }` or a masked email hint.
- Keep full user identity out of the public validation response.

## Positive Checks

These areas looked materially better and did not produce high-priority findings during this pass:

- Stripe webhook signature verification is present in `backend/subscriptions/stripe_views.py:105-120`.
- Shared report passwords are hashed in `backend/surveys/models/report.py:37-52`.
- bKash token-bearing responses are sanitized before storage/use in `backend/subscriptions/bkash_service.py:187-216`.
- No obvious committed production secrets were found in tracked source during a repository-wide pattern scan; matches were limited to examples, docs, and test fixtures.

## Recommended Remediation Order

1. Remove secrets from URLs and stop storing JWTs in `localStorage`.
2. Hash survey access passwords and sanitize all public-survey secret handling.
3. Lock down Django production settings so unsafe deploys fail at startup.
4. Move AI provider keys to a proper secret-management path.
5. Add login and registration throttling before reopening production traffic.
