# Questiz — Compliance Audit Report

**Audit Date:** March 22, 2026
**Scope:** GDPR, HIPAA, WCAG 2.1/2.2 AA
**Application:** Questiz Survey Platform (Django + React + PostgreSQL)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [GDPR Compliance](#1-gdpr-compliance)
3. [HIPAA Compliance](#2-hipaa-compliance)
4. [WCAG 2.1/2.2 AA Accessibility](#3-wcag-2122-aa-accessibility)
5. [Consolidated Remediation Roadmap](#4-consolidated-remediation-roadmap)

---

## Executive Summary

| Framework | Current Status | Compliance Level | Verdict |
|-----------|---------------|-----------------|---------|
| **GDPR** | Major gaps in consent, data export, and retention | ~30% | NOT COMPLIANT |
| **HIPAA** | Critical gaps in encryption at rest, audit logging, and BAA | ~25% | NOT COMPLIANT |
| **WCAG 2.1/2.2 AA** | Solid foundation with Radix UI; gaps in ARIA, forms, skip links | ~65–70% | PARTIALLY COMPLIANT |

**Bottom line:** The application has strong security fundamentals (HTTPS, HSTS, JWT rotation, HttpOnly cookies) and good UI library choices (Radix UI for accessibility). However, it currently lacks the legal, procedural, and data-governance layers required for GDPR and HIPAA. Accessibility is the closest to compliance and can be achieved with targeted fixes.

---

## 1. GDPR Compliance

*General Data Protection Regulation (EU) 2016/679*

### 1.1 Personal Data Inventory

The application collects and stores the following personal data:

| Data Category | Fields | Location | Lawful Basis Documented? |
|--------------|--------|----------|------------------------|
| **Account identity** | username, email, first_name, last_name, phone, organization, designation, bio, avatar | `accounts/models.py` (User) | No |
| **Survey responses** | respondent_email, text answers, numeric answers, file uploads, matrix/ranking data | `surveys/models/response.py`, `answer.py` | No |
| **Device & network** | ip_address, user_agent | `SurveyResponse` model | No |
| **Email invitations** | recipient email, open/click tracking, timestamps | `surveys/models/email_invitation.py` | No |
| **Payment** | stripe_customer_id, stripe_subscription_id, bkash_subscription_id, billing cycle | `subscriptions/models.py` | No |
| **Authentication tokens** | JWT refresh token (HttpOnly cookie), email verification tokens | `accounts/token_cookies.py` | No |

### 1.2 What Exists

| Requirement | Status | Details |
|-------------|--------|---------|
| HTTPS / TLS in transit | **PASS** | `SECURE_SSL_REDIRECT=True`, HSTS 1 year, `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True` |
| Password hashing | **PASS** | Django's `make_password()` / `check_password()` (PBKDF2 by default) |
| Account deletion | **PARTIAL** | `DELETE /api/auth/user/delete/` exists — cascading delete removes user's surveys, exports, subscriptions. However, responses submitted *to* that user's surveys by other respondents remain (FK set to `SET_NULL`). |
| Collector password hashing | **PASS** | Survey link passwords hashed via `make_password()` in `surveys/security.py` |
| No third-party analytics | **PASS** | No Google Analytics, Facebook Pixel, or similar trackers in the frontend |
| HttpOnly refresh token | **PASS** | Refresh token in HttpOnly + SameSite=Lax cookie, not in localStorage |

### 1.3 What Is Missing

| # | Gap | GDPR Article | Severity | Details |
|---|-----|-------------|----------|---------|
| G1 | **No Privacy Policy page** | Art. 13, 14 | CRITICAL | No `/privacy` or `/terms` route exists. No explanation of data collection purposes, legal bases, retention periods, or user rights. |
| G2 | **No Cookie Consent Banner** | Art. 6, 7 + ePrivacy Directive | CRITICAL | The app sets cookies (`questiz_refresh`, `questiz_responded_{slug}`) without informing or asking the user. |
| G3 | **No Consent Tracking** | Art. 7(1) | CRITICAL | No database table records when/how a user consented. Cannot demonstrate consent if challenged. |
| G4 | **No Data Subject Access Request (DSAR) Export** | Art. 15 | CRITICAL | No endpoint for users to download all their personal data in a portable format (JSON/CSV). |
| G5 | **No Data Retention Policy** | Art. 5(1)(e) | HIGH | Survey responses, IP addresses, and user-agent strings are stored indefinitely. No auto-purge or configurable TTL. |
| G6 | **IP & User-Agent collected without basis** | Art. 6 | HIGH | `ip_address` and `user_agent` captured on every public survey submission via `get_client_ip()` in `response_views.py`. No consent or legitimate-interest assessment. |
| G7 | **AI services receive PII without consent** | Art. 44–49 | HIGH | Survey content (potentially containing respondent PII) is sent to OpenAI/Anthropic for AI Insights. Some masking exists (`_mask_text()` in `ai_insights.py`) but it is incomplete — no masking for SSNs, medical info, or arbitrary PII in open-text answers. |
| G8 | **No Data Processing Agreements (DPA)** | Art. 28 | HIGH | No documented DPAs with Stripe, bKash, OpenAI, or Anthropic visible in the project. |
| G9 | **Incomplete cascade on account deletion** | Art. 17 | MEDIUM | Responses submitted by other people to the deleted user's surveys persist with `user=NULL`. Email invitation records also persist. |
| G10 | **No audit logging** | Art. 5(2) accountability | MEDIUM | No record of who accessed, modified, or deleted personal data. Cannot demonstrate compliance. |
| G11 | **Completion cookie missing Secure flag** | ePrivacy / best practice | LOW | `questiz_responded_{slug}` cookie set without `Secure` attribute in `response_views.py:308-314`. |

### 1.4 Recommended Solutions — GDPR

| # | Fix | Implementation |
|---|-----|---------------|
| G1 | **Create Privacy Policy & Terms pages** | Add `frontend/src/pages/PrivacyPolicy.jsx` and `Terms.jsx`. Cover: identity of controller, data categories, legal bases (consent for cookies, contract for account, legitimate interest for IP-based fraud prevention), retention periods, third-party processors, user rights (access, rectification, erasure, portability, objection), DPO contact. Link from registration form, footer, and cookie banner. |
| G2 | **Add Cookie Consent Banner** | Implement a banner component that categorises cookies (Strictly Necessary vs. Functional). The `questiz_refresh` cookie is strictly necessary (auth). The `questiz_responded_*` cookie is functional — require opt-in. Store consent state in localStorage and a backend `ConsentLog` table. Consider an open-source library like `react-cookie-consent` or `cookieconsent`. |
| G3 | **Create ConsentLog model** | Add to `accounts/models.py`: `ConsentLog(user, consent_type, granted, ip_address, timestamp)`. Record consent for: cookies, privacy policy acceptance, AI data processing. |
| G4 | **Build DSAR Export endpoint** | Add `GET /api/auth/user/export/` that compiles: user profile, all surveys (with questions/choices), all responses to user's surveys, all subscription/payment records, all email invitations. Return as downloadable JSON or ZIP. |
| G5 | **Add Data Retention settings** | Add per-survey `retention_days` field. Create a Celery periodic task that anonymises or deletes responses older than the threshold. Add a global default in `SiteSettings`. |
| G6 | **Make IP/UA collection opt-in or justified** | Either: (a) add a legitimate-interest assessment document and reference it in the privacy policy, or (b) make IP/UA collection a toggle on the Collector model (`anonymize` field already exists — enforce it to strip IP/UA when enabled). |
| G7 | **Add explicit AI consent** | Before first use of AI Insights, show an opt-in dialog: "Survey data will be sent to [provider] for analysis." Store consent in `ConsentLog`. Allow survey owners to disable AI features per survey. Enhance `_mask_text()` to handle broader PII patterns. |
| G8 | **Document DPAs** | Obtain and store signed DPAs with Stripe, bKash, OpenAI, Anthropic. Reference them in the privacy policy. |
| G9 | **Improve deletion cascade** | On account deletion, offer the user a choice: (a) delete all surveys and their associated responses, or (b) anonymise responses (strip respondent_email, null out IP/UA). Log the deletion event. |
| G10 | **Implement audit logging** | See HIPAA section (shared requirement). |
| G11 | **Add Secure flag to completion cookie** | In `response_views.py`, add `secure=True` to `set_cookie()` call when `settings.SESSION_COOKIE_SECURE` is True. |

---

## 2. HIPAA Compliance

*Health Insurance Portability and Accountability Act — Security Rule (45 CFR Part 164)*

> **Important context:** Questiz is a general-purpose survey tool, not a healthcare application. However, if customers use it to collect Protected Health Information (PHI) — e.g., patient satisfaction surveys, health assessments — HIPAA obligations apply.

### 2.1 Can PHI Be Collected?

**Yes.** Multiple question types enable PHI collection:

| Question Type | PHI Risk | Example |
|--------------|----------|---------|
| `short_text` / `long_text` | HIGH | "Describe your symptoms" |
| `demographics` | MEDIUM | Age, gender, ethnicity |
| `file_upload` | HIGH | Medical documents, lab results |
| `date_time` | MEDIUM | Date of last visit |
| `matrix` | MEDIUM | Symptom severity grids |
| `rating_scale` / `nps` | LOW | Satisfaction scores (identifiable when linked to email) |

**There is no mechanism to flag, restrict, or encrypt surveys that collect PHI.**

### 2.2 What Exists

| HIPAA Requirement | Status | Details |
|-------------------|--------|---------|
| **Encryption in transit** (§164.312(e)(1)) | **PASS** | HTTPS enforced, HSTS, Secure cookies |
| **Access control — authentication** (§164.312(d)) | **PASS** | JWT with 1-hour access tokens, 7-day rotating refresh tokens, token blacklisting |
| **Session management** | **PASS** | Refresh token rotation + blacklist, HttpOnly cookies, SameSite=Lax |
| **Unique user identification** (§164.312(a)(2)(i)) | **PASS** | UUID primary keys, unique email/username |
| **Password security** | **PASS** | PBKDF2 hashing, login rate limiting |

### 2.3 What Is Missing

| # | Gap | HIPAA Rule | Severity | Details |
|---|-----|-----------|----------|---------|
| H1 | **No encryption at rest** | §164.312(a)(2)(iv) | CRITICAL | All database fields (answers, emails, IP addresses, files) stored in plaintext. Uploaded files stored unencrypted at `MEDIA_ROOT`. |
| H2 | **No audit logging** | §164.312(b) | CRITICAL | No audit trail for data access, modification, or deletion. Cannot track who viewed PHI or when. |
| H3 | **No Business Associate Agreements (BAA)** | §164.308(b)(1) | CRITICAL | AI services (OpenAI/Anthropic) process survey data that may contain PHI — no BAA exists. Same gap for Stripe, bKash, hosting provider, email service. |
| H4 | **No role-based access control (RBAC)** | §164.312(a)(1) | HIGH | Only two roles: superuser/staff and regular user. No fine-grained roles (viewer, editor, admin per survey or workspace). |
| H5 | **No file access control** | §164.312(a)(1) | HIGH | Uploaded files served from `MEDIA_URL = "/media/"` — potentially directly accessible if web server misconfigured. No per-file authorization check. |
| H6 | **No PHI flagging or segmentation** | §164.530(c) | HIGH | No way to mark a survey as "contains PHI" to trigger additional safeguards (encryption, access restrictions, audit intensity). |
| H7 | **No backup / disaster recovery plan** | §164.308(a)(7) | MEDIUM | No application-level backup mechanism. Database backups depend entirely on infrastructure. |
| H8 | **No automatic session termination** | §164.312(a)(2)(iii) | MEDIUM | No idle timeout for authenticated sessions. Access token expires in 1 hour but refresh token auto-renews for 7 days. |
| H9 | **No intrusion detection** | §164.308(a)(1)(ii)(D) | MEDIUM | No monitoring for unusual access patterns (bulk data downloads, off-hours access, repeated failed auth). |
| H10 | **AI PII masking is incomplete** | §164.502(a) | MEDIUM | `_mask_text()` masks emails, phones, and URLs but not SSNs, medical record numbers, or health-specific identifiers. |
| H11 | **No security incident response plan** | §164.308(a)(6) | LOW | No documented procedure for breach notification (required within 60 days under HIPAA). |

### 2.4 Recommended Solutions — HIPAA

| # | Fix | Implementation |
|---|-----|---------------|
| H1 | **Add field-level encryption at rest** | Use `django-encrypted-model-fields` or `django-fernet-fields` to encrypt: `Answer.text_value`, `Answer.file_url`, `SurveyResponse.respondent_email`, `SurveyResponse.ip_address`. For file uploads, encrypt files before writing to disk (use `cryptography.fernet`). Enable PostgreSQL TDE or use an encrypted volume at the infrastructure level for defense-in-depth. |
| H2 | **Implement audit logging** | Create an `AuditLog` model: `(id, user, action, resource_type, resource_id, ip_address, metadata_json, timestamp)`. Log events: login success/failure, survey viewed, responses accessed, data exported, data deleted, account changes, admin actions. Use Django signals or middleware. Consider `django-auditlog` as a starting point. |
| H3 | **Obtain BAAs** | Before any PHI touches the platform: (a) Sign BAA with hosting provider (AWS/GCP/Azure all offer them). (b) Sign BAA with OpenAI (available on their Team/Enterprise plans) or switch to a HIPAA-eligible AI provider. (c) Sign BAA with email service provider. (d) Document all BAAs and review annually. |
| H4 | **Implement RBAC** | Add a `SurveyRole` model: `(user, survey, role: owner/editor/viewer)`. Enforce at the viewset level. Extend to workspace-level roles if multi-tenant. |
| H5 | **Secure file access** | Serve media files through a Django view (not directly via web server) that checks authentication and ownership. Use signed URLs with expiration for temporary access. |
| H6 | **Add PHI mode toggle** | Add a `contains_phi` boolean to the Survey model. When enabled: require authenticated respondents only, encrypt answers at rest, increase audit log verbosity, restrict AI processing, warn the survey creator about compliance requirements. |
| H7 | **Document backup/recovery** | Implement automated PostgreSQL backups (pg_dump) via Celery Beat or infrastructure cron. Encrypt backup files. Test restoration quarterly. Document RTO/RPO targets. |
| H8 | **Add idle session timeout** | Implement a frontend idle detector (e.g., after 15 minutes of inactivity, prompt the user; after 20 minutes, force logout by clearing tokens). |
| H9 | **Add anomaly monitoring** | Log and alert on: >N failed login attempts per hour, bulk response exports, API calls from new IP ranges, off-hours admin access. Use Celery tasks to scan logs periodically. |
| H10 | **Enhance PII masking for AI** | Extend `_mask_text()` to detect and mask: SSN patterns (`\d{3}-\d{2}-\d{4}`), MRN patterns, dates of birth, and any text matching known PHI categories. Consider using a dedicated PII detection library (e.g., `presidio` by Microsoft). |
| H11 | **Create incident response plan** | Document: breach identification steps, internal escalation, HIPAA breach notification timeline (60 days), HHS reporting requirements, affected-individual notification template. |

---

## 3. WCAG 2.1/2.2 AA Accessibility

*Web Content Accessibility Guidelines*

### 3.1 Compliance Summary

| WCAG Criterion | Status | Rating | Priority |
|---------------|--------|--------|----------|
| **1.1.1** Non-text Content (alt text) | PASS | 90% | Low |
| **1.3.1** Info and Relationships (semantic HTML) | PARTIAL | 80% | Medium |
| **1.4.3** Contrast (Minimum) | UNCERTAIN | ~50% | **HIGH** |
| **1.4.4** Resize Text (200% zoom) | PASS | 100% | Low |
| **2.1.1** Keyboard Accessible | PARTIAL | 65% | **HIGH** |
| **2.4.1** Bypass Blocks (skip link) | FAIL | 0% | **HIGH** |
| **2.4.3** Focus Order | PASS | 85% | Low |
| **2.4.7** Focus Visible | PASS | 95% | Low |
| **2.3.1** Three Flashes or Below | PASS | 100% | Low |
| **2.5.8** Target Size (WCAG 2.2) | PARTIAL | 70% | Medium |
| **3.1.1** Language of Page | PASS | 100% | Low |
| **3.3.1** Error Identification | PARTIAL | 40% | **HIGH** |
| **3.3.2** Labels or Instructions | PARTIAL | 55% | **HIGH** |
| **4.1.2** Name, Role, Value (ARIA) | PARTIAL | 40% | **HIGH** |

### 3.2 What Exists (Strengths)

| Area | Details |
|------|---------|
| **Radix UI components** | Dialog, Dropdown, Slider, Avatar, Label all provide built-in keyboard support, focus management, and ARIA attributes. Excellent library choice. |
| **Semantic HTML** | `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>` used correctly. Proper heading hierarchy (h1 > h2 > h3) on most pages. |
| **Focus indicators** | Consistent `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` applied to Button, Input, Textarea, Select, and other interactive components. |
| **Alt text on images** | All `<img>` elements found have `alt` attributes — BrandLogo, login/register visuals, survey previews, image choices. |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` in `index.css` disables all homepage animations. Excellent implementation. |
| **Responsive design** | Mobile-first with Tailwind breakpoints. Viewport allows user zoom (no `user-scalable=no`). Root font size uses percentage (90%). |
| **Language attribute** | `<html lang="en">` set correctly in `index.html`. |
| **Screen reader utilities** | `sr-only` class used for visually-hidden text (e.g., Dialog close button). |
| **Switch component** | Custom switch uses `role="switch"` and `aria-checked`. |
| **Alert component** | Uses `role="alert"` for important notifications. |

### 3.3 What Is Missing

| # | Gap | WCAG SC | Severity | Details |
|---|-----|---------|----------|---------|
| A1 | **No skip-to-content link** | 2.4.1 Bypass Blocks | CRITICAL | No "Skip to main content" link exists. Keyboard users must tab through the entire navbar on every page. |
| A2 | **Form labels not associated with inputs** | 1.3.1, 3.3.2 | CRITICAL | Login and Register pages use `<label>` elements but lack `htmlFor` attributes. Screen readers cannot associate labels with their inputs. |
| A3 | **Form errors not announced** | 3.3.1, 4.1.3 | CRITICAL | Error messages display visually but are not linked to inputs via `aria-invalid` or `aria-errormessage`. Screen readers do not announce validation errors. |
| A4 | **Missing ARIA on dynamic content** | 4.1.2, 4.1.3 | HIGH | No `aria-live` regions for: survey question transitions, analytics data updates, toast notifications outside the Radix toast component, AI chat responses. |
| A5 | **Icon-only buttons lack labels** | 1.1.1, 4.1.2 | HIGH | Some icon buttons (e.g., in the survey builder toolbar) do not have `aria-label` or visually-hidden text. Screen readers announce them as unlabelled buttons. |
| A6 | **Color contrast unverified** | 1.4.3 | HIGH | Muted foreground `hsl(332 19.4% 28.2%)` on white background may fall below 4.5:1. Secondary colors at 95.1% lightness have near-zero contrast with white backgrounds. Disabled states unverified. Chart colors unverified. |
| A7 | **Survey builder not keyboard-navigable** | 2.1.1 | HIGH | The drag-and-drop survey builder canvas cannot be operated via keyboard. No arrow-key navigation between questions, no keyboard-based reordering. |
| A8 | **No `aria-describedby` for form descriptions** | 1.3.1 | MEDIUM | Survey question descriptions/help text are visible but not programmatically linked to their inputs. |
| A9 | **Custom dropdowns may lack full keyboard support** | 2.1.1 | MEDIUM | Non-Radix custom select components may not support full keyboard navigation (Arrow keys, Home/End, type-ahead). |
| A10 | **Insufficient alt text quality** | 1.1.1 | LOW | Some alt text is vague (e.g., `alt="Login visual"`, `alt="Register visual"`). Should describe the image content or be empty (`alt=""`) if decorative. |

### 3.4 Recommended Solutions — WCAG

| # | Fix | Implementation |
|---|-----|---------------|
| A1 | **Add skip-to-content link** | In `App.jsx`, add as the first child: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Skip to main content</a>`. Add `id="main-content"` to the `<main>` element. |
| A2 | **Associate all form labels** | In `Login.jsx` and `Register.jsx`: add `id` to each `<input>` (e.g., `id="login-username"`), add `htmlFor="login-username"` to the corresponding `<label>`. Repeat for every form across the app. Alternatively, wrap each `<input>` inside its `<label>` for implicit association. |
| A3 | **Make form errors accessible** | Add `aria-invalid={!!error}` to inputs with errors. Add `id="error-fieldname"` to the error message element. Add `aria-errormessage="error-fieldname"` to the input. Wrap error messages in `role="alert"` so screen readers announce them immediately. |
| A4 | **Add `aria-live` regions** | Survey question container: `aria-live="polite"` so question changes are announced. AI chat response area: `aria-live="polite"`. Analytics data panels: `aria-live="polite"` with `aria-atomic="true"`. |
| A5 | **Label all icon buttons** | Audit every `<button>` that contains only an icon. Add `aria-label="Description"` (e.g., `aria-label="Delete question"`, `aria-label="Move up"`, `aria-label="Settings"`). |
| A6 | **Verify and fix contrast** | Run the full color palette through WebAIM Contrast Checker. Fix muted-foreground to meet 4.5:1. Ensure all chart colors pass 3:1 against their backgrounds. Test disabled states. Document passing ratios. |
| A7 | **Add keyboard support to builder** | Implement arrow-key navigation between questions. Add keyboard-based reorder (e.g., Alt+Up/Down to move a question). Provide keyboard alternatives for all drag-and-drop operations. Consider `@dnd-kit`'s built-in keyboard sensor. |
| A8 | **Link descriptions with `aria-describedby`** | In `QuestionRenderer.jsx`: add `id="desc-{questionId}"` to description text, add `aria-describedby="desc-{questionId}"` to the input/fieldset. |
| A9 | **Audit custom dropdowns** | Ensure all custom select/dropdown components support: Arrow Up/Down to navigate options, Enter/Space to select, Escape to close, Home/End for first/last option. Consider replacing custom implementations with Radix Select. |
| A10 | **Improve alt text** | Change `alt="Login visual"` to either a meaningful description (`alt="Person collaborating on a survey dashboard"`) or mark as decorative (`alt=""`, `role="presentation"`) if the image is purely ornamental. |

---

## 4. Consolidated Remediation Roadmap

### Priority 1 — Critical (Blocks compliance claims)

| ID | Task | Frameworks | Effort |
|----|------|-----------|--------|
| G1 | Create Privacy Policy & Terms of Service pages | GDPR | 2–3 days |
| G2 | Implement Cookie Consent Banner | GDPR | 1–2 days |
| G4 | Build DSAR data export endpoint | GDPR | 2–3 days |
| H1 | Add field-level encryption at rest for PII/PHI fields | HIPAA, GDPR | 3–5 days |
| H2 | Implement comprehensive audit logging | HIPAA, GDPR | 3–5 days |
| H3 | Obtain and document BAAs with all third-party processors | HIPAA, GDPR | 1–2 weeks (external) |
| A1 | Add skip-to-content navigation link | WCAG | 30 minutes |
| A2 | Associate all form labels with `htmlFor` | WCAG | 2–3 hours |
| A3 | Make form validation errors accessible | WCAG | 1 day |

### Priority 2 — High (Significant compliance risk)

| ID | Task | Frameworks | Effort |
|----|------|-----------|--------|
| G3 | Create ConsentLog model and consent tracking | GDPR | 1–2 days |
| G5 | Implement data retention policies and auto-purge | GDPR | 2–3 days |
| G6 | Justify or make opt-in: IP/UA collection | GDPR | 1 day |
| G7 | Add explicit consent for AI data processing | GDPR | 1–2 days |
| H4 | Implement role-based access control (RBAC) | HIPAA | 3–5 days |
| H5 | Secure file uploads behind auth-gated views | HIPAA | 1–2 days |
| H6 | Add PHI mode toggle with enhanced safeguards | HIPAA | 2–3 days |
| A4 | Add `aria-live` regions for dynamic content | WCAG | 1 day |
| A5 | Add `aria-label` to all icon-only buttons | WCAG | 2–3 hours |
| A6 | Verify and fix color contrast ratios | WCAG | 1 day |
| A7 | Add keyboard navigation to survey builder | WCAG | 2–3 days |

### Priority 3 — Medium (Reduces risk, improves posture)

| ID | Task | Frameworks | Effort |
|----|------|-----------|--------|
| G8 | Document DPAs with all processors | GDPR | External process |
| G9 | Improve account deletion cascade / anonymisation | GDPR | 1 day |
| G10 | Audit logging (covered by H2) | GDPR, HIPAA | — |
| H7 | Document and implement backup/recovery plan | HIPAA | 1–2 days |
| H8 | Add idle session timeout (15–20 min) | HIPAA | 1 day |
| H9 | Add anomaly detection / alerting | HIPAA | 2–3 days |
| H10 | Enhance AI PII masking with broader patterns | HIPAA | 1–2 days |
| A8 | Link question descriptions with `aria-describedby` | WCAG | 2–3 hours |
| A9 | Audit and fix custom dropdown keyboard support | WCAG | 1 day |

### Priority 4 — Low (Polish and best practice)

| ID | Task | Frameworks | Effort |
|----|------|-----------|--------|
| G11 | Add Secure flag to completion cookie | GDPR | 15 minutes |
| H11 | Create security incident response plan | HIPAA | 1 day (documentation) |
| A10 | Improve alt text quality on decorative images | WCAG | 1 hour |

---

### Testing Tools Recommended

| Purpose | Tool |
|---------|------|
| Accessibility automated scan | axe DevTools, WAVE, Lighthouse |
| Screen reader testing | VoiceOver (macOS), NVDA (Windows) |
| Keyboard-only testing | Manual — tab through every flow |
| Color contrast | WebAIM Contrast Checker, Colour Contrast Analyser |
| GDPR gap analysis | OneTrust Assessment, manual checklist |
| Security / HIPAA | OWASP ZAP, penetration testing firm |
| Audit log verification | Manual review + automated test suite |

---

*End of report.*
