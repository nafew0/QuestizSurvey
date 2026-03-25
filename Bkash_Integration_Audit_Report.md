# bKash Payment Gateway Integration — Audit & Approval Readiness Report

**Project:** Questiz Survey (survey.mindspear.app)
**Integration Type:** Tokenized Checkout — URL-Based (Mode `0011`)
**Stack:** Django + DRF (Backend), React (Frontend)
**Date:** March 25, 2026

---

## Table of Contents

0. [How bKash Payment Actually Works (Plain English)](#0-how-bkash-payment-actually-works-plain-english)
1. [Executive Summary](#1-executive-summary)
2. [What You Have Followed (Compliant)](#2-what-you-have-followed-compliant)
3. [What You Have Missed (Gaps)](#3-what-you-have-missed-gaps)
4. [Risk Priority Matrix](#4-risk-priority-matrix)
5. [Likely Questions from bKash Developer Team & Suggested Answers](#5-likely-questions-from-bkash-developer-team--suggested-answers)
6. [Technical UAT Checklist](#6-technical-uat-checklist)
7. [Recommendations for Go-Live](#7-recommendations-for-go-live)

---

## 0. How bKash Payment Actually Works (Plain English)

Think of the whole bKash payment flow like ordering food through a delivery app. You (the merchant website) don't handle the customer's wallet directly — you hand the customer over to bKash, bKash collects the money, and then bKash tells you "they paid" so you can give them what they bought.

Here is every step, from the moment the user clicks "Pay" to the moment their subscription activates.

---

### The Big Picture (3 Parties Involved)

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   YOUR APP  │       │   bKash SERVERS  │       │  CUSTOMER   │
│  (Questiz)  │◄─────►│  (Payment Gate)  │◄─────►│  (Browser)  │
│  Frontend + │       │                  │       │             │
│  Backend    │       │  Holds the money │       │  Has bKash  │
│             │       │  Does the OTP    │       │  wallet     │
└─────────────┘       └──────────────────┘       └─────────────┘
```

- **Your App** = your Questiz website (the React frontend the user sees + the Django backend that talks to bKash secretly)
- **bKash Servers** = bKash's payment gateway (you never touch the customer's money directly — bKash handles it)
- **Customer** = the person paying with their bKash wallet

---

### Step-by-Step Flow

#### PHASE 1: Before Any Payment Can Happen — "Getting the Key to the Door"

Before your backend can talk to bKash at all, it needs a **token** (think of it like a temporary password).

```
YOUR BACKEND                          bKASH SERVER
     │                                      │
     │  "Hey bKash, here's my app_key,      │
     │   app_secret, username, password.     │
     │   Let me in."                         │
     │ ────────────────────────────────────► │
     │                                      │
     │  "OK, here's your id_token.           │
     │   It's valid for 1 hour.              │
     │   Here's also a refresh_token         │
     │   (valid for 28 days)."               │
     │ ◄──────────────────────────────────── │
     │                                      │
     │  (stores token in cache/Redis)        │
     │                                      │
```

**In plain terms:** Your backend says "I'm a legitimate merchant" by showing its credentials. bKash says "OK, I believe you, here's a temporary pass." Your backend saves this pass (the `id_token`) and reuses it for up to 1 hour. It does NOT ask for a new pass every time — bKash will block you if you do that more than twice an hour.

**Your code does this in:** `bkash_service.py` → `grant_token()` and `refresh_token()`

---

#### PHASE 2: User Clicks "Pay with bKash" — "Creating the Checkout Session"

```
CUSTOMER'S BROWSER          YOUR BACKEND               bKASH SERVER
       │                         │                          │
       │  User clicks            │                          │
       │  "Pay with bKash"       │                          │
       │  (plan: Pro, monthly)   │                          │
       │ ──────────────────────► │                          │
       │                         │                          │
       │                         │  Before talking to bKash,│
       │                         │  backend checks:         │
       │                         │  - Is user logged in?    │
       │                         │  - Does this plan exist? │
       │                         │  - Is BDT price set?     │
       │                         │  - Does user already     │
       │                         │    have an active sub?   │
       │                         │  - Rate limit OK?        │
       │                         │                          │
       │                         │  All good? Then:         │
       │                         │                          │
       │                         │  "bKash, I need to       │
       │                         │   collect ৳499 from a    │
       │                         │   customer. Here's my    │
       │                         │   callback URL where     │
       │                         │   you'll send them back."│
       │                         │ ───────────────────────► │
       │                         │                          │
       │                         │  "OK, here's a paymentID │
       │                         │   and a bkashURL. Send   │
       │                         │   the customer there."   │
       │                         │ ◄─────────────────────── │
       │                         │                          │
       │                         │  Backend saves a         │
       │                         │  BkashTransaction record │
       │                         │  status = INITIATED      │
       │                         │                          │
       │  "Here's the bKash URL, │                          │
       │   go there to pay."     │                          │
       │ ◄────────────────────── │                          │
       │                         │                          │
```

**In plain terms:** When the user clicks "Pay", your frontend tells your backend "this user wants to buy Pro monthly." Your backend first checks if everything is valid (is the user logged in? do they already have a subscription? is the price set?). Then it asks bKash: "I need to collect ৳499, please create a checkout page." bKash responds with a URL. Your backend saves a record of this payment attempt (status: `INITIATED`) and sends the URL back to the frontend.

**Your code does this in:** `bkash_views.py` → `BkashCheckoutView.post()` and `bkash_service.py` → `create_payment()`

---

#### PHASE 3: Customer Pays on bKash's Page — "The Customer's Side"

```
CUSTOMER'S BROWSER                    bKASH SERVER
       │                                   │
       │  Browser redirects to             │
       │  bkashURL (bKash's page)          │
       │ ────────────────────────────────► │
       │                                   │
       │  bKash asks:                      │
       │  "Enter your wallet number"       │
       │ ◄──────────────────────────────── │
       │                                   │
       │  Customer types: 01XXXXXXXXX      │
       │ ────────────────────────────────► │
       │                                   │
       │  bKash sends OTP to customer's    │
       │  phone via SMS                    │
       │                                   │
       │  "Enter the OTP we sent you"      │
       │ ◄──────────────────────────────── │
       │                                   │
       │  Customer types: 123456           │
       │ ────────────────────────────────► │
       │                                   │
       │  "Enter your bKash PIN"           │
       │ ◄──────────────────────────────── │
       │                                   │
       │  Customer types: XXXXX            │
       │ ────────────────────────────────► │
       │                                   │
       │  bKash deducts ৳499 from the      │
       │  customer's wallet                │
       │                                   │
       │  bKash redirects the browser      │
       │  back to YOUR callback URL:       │
       │  yoursite.com/api/payments/       │
       │  bkash/callback/                  │
       │  ?paymentID=abc123                │
       │  &status=success                  │
       │ ◄──────────────────────────────── │
       │                                   │
```

**In plain terms:** This is entirely on bKash's hosted page — your code does nothing here. The customer sees bKash's UI, enters their wallet number, receives an OTP on their phone, enters it, then enters their PIN. bKash deducts the money. Then bKash redirects the customer's browser back to your website with the result (`status=success` or `status=cancel` or `status=failure`).

**Important:** At this point, the money has left the customer's wallet. But your app doesn't know yet whether the payment is real. The `status=success` in the URL is just bKash saying "the customer completed the steps." It is NOT proof of payment — someone could fake this URL.

---

#### PHASE 4: The Callback — "Verifying the Payment is Real"

This is the most critical phase. This is where your backend makes sure the payment actually happened.

```
CUSTOMER'S BROWSER          YOUR BACKEND               bKASH SERVER
       │                         │                          │
       │  Browser arrives at     │                          │
       │  /callback/?paymentID=  │                          │
       │  abc123&status=success  │                          │
       │ ──────────────────────► │                          │
       │                         │                          │
       │                         │  Backend checks:         │
       │                         │  1. Is the source IP     │
       │                         │     from bKash?          │
       │                         │     (IP allowlist)       │
       │                         │  2. Is rate limit OK?    │
       │                         │  3. Does this paymentID  │
       │                         │     exist in our DB?     │
       │                         │                          │
       │                         │  All good? Now the KEY   │
       │                         │  STEP — DON'T TRUST THE  │
       │                         │  CALLBACK, ASK bKASH     │
       │                         │  DIRECTLY:               │
       │                         │                          │
       │                         │  "bKash, I have          │
       │                         │   paymentID abc123.      │
       │                         │   Please EXECUTE it      │
       │                         │   (confirm the payment)."│
       │                         │ ───────────────────────► │
       │                         │                          │
       │                         │  "Yes, payment confirmed.│
       │                         │   statusCode: 0000       │
       │                         │   trxID: TRX789XYZ       │
       │                         │   transactionStatus:     │
       │                         │   Completed"             │
       │                         │ ◄─────────────────────── │
       │                         │                          │
       │                         │  Backend now:            │
       │                         │  1. Checks statusCode    │
       │                         │     is "0000"            │
       │                         │  2. Checks trxID exists  │
       │                         │  3. Updates transaction  │
       │                         │     → COMPLETED          │
       │                         │  4. Activates the user's │
       │                         │     subscription (Pro)   │
       │                         │  5. Logs everything      │
       │                         │                          │
       │  "Payment successful!   │                          │
       │   Redirecting to        │                          │
       │   /payment/success"     │                          │
       │ ◄────────────────────── │                          │
       │                         │                          │
```

**In plain terms:** When the customer's browser lands on your callback URL, your backend does NOT just say "oh status=success, great, activate the subscription." That would be dangerous — anyone could type that URL in their browser. Instead, your backend takes the `paymentID`, goes DIRECTLY to bKash's server, and says "Did this payment really happen?" (this is the **Execute Payment** API call). Only when bKash confirms with `statusCode: 0000` and a real `trxID` does your backend activate the subscription.

**Your code does this in:** `bkash_views.py` → `bkash_callback_view()` and `bkash_service.py` → `sync_transaction()` → `verify_payment()` → `execute_payment()`

---

#### PHASE 4b: What If Execute Fails? — "The Fallback"

Sometimes the Execute API returns a weird response (like "already processed" or it times out). Your code handles this:

```
YOUR BACKEND                          bKASH SERVER
     │                                      │
     │  Execute Payment → weird response    │
     │  ("already processed" or timeout)    │
     │ ◄──────────────────────────────────── │
     │                                      │
     │  OK, let me try the QUERY API        │
     │  instead. "bKash, what's the status  │
     │  of paymentID abc123?"               │
     │ ────────────────────────────────────► │
     │                                      │
     │  "transactionStatus: Completed,      │
     │   trxID: TRX789XYZ"                  │
     │ ◄──────────────────────────────────── │
     │                                      │
     │  Great, payment is confirmed.        │
     │  Activate subscription.              │
     │                                      │
```

**In plain terms:** If "Execute" gives a confusing answer, your backend has a Plan B — it asks bKash "just tell me the current status of this payment" using the Query API. This prevents money from being taken but the subscription not activating.

**Your code does this in:** `bkash_service.py` → `verify_payment()` catches `BkashExecutionFallbackRequired` and calls `query_payment()`

---

#### PHASE 5: After Payment — "The User Sees the Result"

```
CUSTOMER'S BROWSER          YOUR BACKEND
       │                         │
       │  Lands on               │
       │  /payment/success       │
       │  ?provider=bkash        │
       │                         │
       │  Frontend shows         │
       │  "Payment successful!"  │
       │                         │
       │  Frontend polls:        │
       │  GET /api/payments/     │
       │  bkash/status/abc123/   │
       │  (up to 5 times,        │
       │   1.2s apart)           │
       │ ──────────────────────► │
       │                         │
       │  { status: "completed", │
       │    plan: "Pro" }        │
       │ ◄────────────────────── │
       │                         │
       │  Shows: "You're now     │
       │  on the Pro plan!"      │
       │                         │
```

**In plain terms:** The user sees a success page. The frontend double-checks by polling the status endpoint a few times to make sure the subscription was actually activated in the database.

---

### The Complete Flow in One Diagram

```
USER clicks "Pay with bKash"
         │
         ▼
┌─────────────────────────────────────────┐
│ FRONTEND sends plan + cycle to backend  │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ BACKEND validates (auth, plan, price,   │
│ no duplicate subscription)              │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ BACKEND calls bKash "Create Payment"    │
│ → gets paymentID + bkashURL             │
│ → saves BkashTransaction (INITIATED)    │
│ → returns bkashURL to frontend          │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ FRONTEND redirects user to bkashURL     │
│ (bKash's hosted checkout page)          │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ USER enters wallet number → OTP → PIN   │
│ on bKash's page                         │
│ (money is deducted from wallet)         │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ bKASH redirects browser to YOUR         │
│ callback URL with paymentID + status    │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ BACKEND receives callback               │
│ → checks IP allowlist                   │
│ → checks rate limit                     │
│ → looks up paymentID in database        │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ BACKEND calls bKash "Execute Payment"   │
│ (this is the REAL verification)         │
│                                         │
│ If success (statusCode=0000 + trxID):   │
│   → Update transaction → COMPLETED      │
│   → Activate user subscription          │
│   → Redirect to /payment/success        │
│                                         │
│ If "already processed":                 │
│   → Call "Query Payment" as fallback    │
│   → Check transactionStatus             │
│                                         │
│ If failure/cancel/expired:              │
│   → Update transaction status           │
│   → Redirect to /payment/failed         │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│ USER sees success or failure page       │
│ Frontend polls status to confirm        │
└─────────────────────────────────────────┘
```

---

### Why It's Designed This Way (The Security Reasoning)

| Design Choice | Why |
|---|---|
| **Backend talks to bKash, never the frontend** | If the frontend had your `app_secret`, anyone could open browser DevTools, steal it, and make payments pretending to be you. |
| **Token is cached and reused** | bKash blocks you if you request more than 2 tokens per hour. Caching prevents this. |
| **Callback is not trusted alone** | Anyone can type `yoursite.com/callback?status=success&paymentID=something` in their browser. That's why we call Execute Payment to verify with bKash directly. |
| **IP allowlist on callbacks** | Even though we verify with Execute, the allowlist adds another layer — only requests coming from bKash's actual servers are processed. |
| **Atomic database transactions** | If two callback requests arrive at the same time (race condition), `select_for_update()` ensures only one is processed. Without this, a user could get their subscription activated twice. |
| **Sanitized responses stored** | We save bKash's response for audit/debugging, but we strip out sensitive fields like tokens and phone numbers before saving. |

---

## 1. Executive Summary

Your bKash integration is **well-architected and covers most security best practices**. The codebase demonstrates strong token management, comprehensive audit logging, atomic database transactions, response sanitization, and proper error handling. However, there are **several gaps** — most notably the absence of a Webhook/IPN listener, no Refund API implementation, missing `BKASH_CALLBACK_TRUSTED_IPS` configuration, and no Search Transaction API — that the bKash developer team will likely raise during the Technical UAT and domain approval review.

**Overall Readiness: ~75%** — Strong foundation, but the missing items below are likely blockers for production approval.

---

## 2. What You Have Followed (Compliant)

### 2.1 Token Management — EXCELLENT

| Requirement | Your Implementation | Status |
|---|---|---|
| Reuse `id_token` (not per-request) | Cached in Django cache with TTL = `expires_in - 60s` | **PASS** |
| Don't call Grant Token > 2x/hour | Cache-first approach; only calls Grant when cache is empty/expired | **PASS** |
| Store tokens server-side only | Django cache backend (Redis in production); never sent to frontend | **PASS** |
| Implement Refresh Token flow | `refresh_token()` method with fallback to `grant_token(force_refresh=True)` | **PASS** |
| Handle refresh token expiry (28 days) | Falls back to fresh Grant Token if refresh fails | **PASS** |
| Auto-retry on auth failure | `_authorized_request()` retries with refreshed/new token on 401/403 or auth error codes | **PASS** |

**Code Reference:** `backend/subscriptions/bkash_service.py:100-392` — Token bundle caching with `TOKEN_CACHE_TTL_FALLBACK_SECONDS = 3500` (58.3 min, just under the 1-hour expiry).

### 2.2 API Security — EXCELLENT

| Requirement | Your Implementation | Status |
|---|---|---|
| All sensitive API calls from backend only | Grant Token, Create, Execute, Query — all in `BkashService` (Python backend) | **PASS** |
| Credentials in environment variables | `settings.py` reads from `os.environ`; `.env.production.example` has empty placeholders | **PASS** |
| Never expose `app_key`/`app_secret` to frontend | Frontend only calls your `/api/payments/bkash/create/` endpoint; no bKash credentials in JS | **PASS** |
| 30-second API timeout | `REQUEST_TIMEOUT_SECONDS = 30` in `BkashService` | **PASS** |
| HTTPS with TLS 1.2+ | Production config has `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000` | **PASS** |
| Proper API headers | `Authorization`, `X-APP-Key`, `Content-Type`, `Accept` all correctly set in `_authorized_request()` | **PASS** |

### 2.3 Payment Flow — VERY GOOD

| Requirement | Your Implementation | Status |
|---|---|---|
| Create → (user redirect) → Callback → Execute → Verify | Full flow implemented across `create_payment()`, `bkash_callback_view`, `verify_payment()` | **PASS** |
| Don't trust callback alone | `sync_transaction()` calls `verify_payment()` (Execute + Query fallback) before activating subscription | **PASS** |
| Query Payment as Execute fallback | `BkashExecutionFallbackRequired` exception triggers `query_payment()` automatically | **PASS** |
| Validate `statusCode === "0000"` | `_is_success_response()` checks against `SUCCESS_CODES = {"0000", "000", "0"}` | **PASS** |
| Verify `transactionStatus === "Completed"` | `_normalize_remote_status()` checks both `transactionStatus` and presence of `trxID` | **PASS** |
| Unique `merchantInvoiceNumber` | Generated as `QTZ-BK-{timestamp}-{random_hex}` using `secrets.token_hex(4)`, stored with DB `unique=True` constraint | **PASS** |
| `payerReference` used correctly | Set to `str(user.id)` (UUID), well under 255 char limit, no special characters | **PASS** |
| Currency set to "BDT" | Hardcoded `"currency": "BDT"` in `create_payment()` | **PASS** |

### 2.4 Callback Security — VERY GOOD

| Requirement | Your Implementation | Status |
|---|---|---|
| IP allowlist for callbacks | `BKASH_CALLBACK_TRUSTED_IPS` + `ip_matches_allowlist()` with CIDR support | **PASS** |
| Rate limiting on callbacks | 30 attempts/hour per IP via `should_throttle_bkash_callback()` | **PASS** |
| Validate `paymentID` against stored records | `sync_transaction()` does `BkashTransaction.objects.filter(payment_id=payment_id)` | **PASS** |
| Handle cancel/expired/failure states | `_map_callback_status()` maps all non-success states to proper DB statuses | **PASS** |
| Graceful redirect on error | `_safe_redirect()` catches all exceptions and falls back to `/payment/failed` | **PASS** |
| Log untrusted callback attempts | `log_audit_event("bkash_callback", outcome="rejected", reason="source_not_allowlisted")` | **PASS** |

### 2.5 Database & State Management — EXCELLENT

| Requirement | Your Implementation | Status |
|---|---|---|
| Atomic transactions | `transaction.atomic()` + `select_for_update()` throughout checkout and sync flows | **PASS** |
| Idempotent payment activation | Double-checks `status == COMPLETED` before processing; returns early if already done | **PASS** |
| Transaction status lifecycle | 5 states: INITIATED → COMPLETED/FAILED/CANCELLED/EXPIRED | **PASS** |
| Full audit trail | `SubscriptionEvent` model with typed events (BKASH_ACTIVATED, etc.) + metadata | **PASS** |
| Store bKash response | `bkash_response = JSONField` stores sanitized API response per transaction | **PASS** |

### 2.6 Response Sanitization — EXCELLENT

| Redacted Field | Reason |
|---|---|
| `id_token` | Auth credential |
| `refresh_token` | Auth credential |
| `token`, `authorization`, `Authorization` | Auth credential variants |
| `customerMsisdn`, `msisdn` | Customer PII (phone number) |
| `payerReference` | Customer identifier |

This is stored in `_sanitize_response()` (`bkash_service.py:188-216`) and applied before any response is persisted to the database.

### 2.7 Error Handling — VERY GOOD

| Requirement | Your Implementation | Status |
|---|---|---|
| Specific exception hierarchy | `BkashConfigurationError`, `BkashServiceError`, `BkashUserInputError`, `BkashApiError`, `BkashExecutionFallbackRequired`, `BkashCheckoutConflictError` | **PASS** |
| Meaningful user messages | `_extract_error_message()` pulls `statusMessage`/`errorMessage` from bKash response | **PASS** |
| Duplicate detection | `_looks_already_processed()` checks for "already"/"duplicate"/"processing" in response | **PASS** |
| Comprehensive logging | All callback outcomes logged via `log_audit_event()` with reasons | **PASS** |

### 2.8 Rate Limiting — GOOD

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /api/payments/bkash/create/` | 10/hour | Per authenticated user |
| `GET /api/payments/bkash/status/<id>/` | 60/hour | Per authenticated user |
| `GET /api/payments/bkash/callback/` | 30/hour | Per source IP |

### 2.9 Subscription Lifecycle — VERY GOOD

| Feature | Implementation |
|---|---|
| Renewal window | 7 days before expiry (`BKASH_RENEWAL_WINDOW_DAYS`) |
| Expiry reminders | 3 days before expiry via Celery task |
| Grace period | 3 days after expiry before auto-downgrade |
| Cancellation | Deferred cancel-at-period-end, not immediate |
| Provider conflict prevention | Blocks bKash checkout if active Stripe subscription exists |

### 2.10 Frontend Security — GOOD

| Requirement | Your Implementation | Status |
|---|---|---|
| No bKash credentials in frontend | Frontend only calls your API, never bKash directly | **PASS** |
| Authenticated checkout initiation | `IsAuthenticated` permission class on `BkashCheckoutView` | **PASS** |
| Payment status polling with retry | 5 sync attempts with 1.2s intervals on PaymentSuccess page | **PASS** |
| Status-aware error pages | `PaymentFailed.jsx` shows different messages for cancel/expired/failed | **PASS** |

---

## 3. What You Have Missed (Gaps)

> **NOTE (Updated):** After a deeper re-audit, the codebase covers far more than initially assessed. The Webhook/IPN listener, Refund API, Search Transaction API, error code `2029` handling, and stale payment cleanup are all **fully implemented**. The previously reported "critical" gaps were incorrect. The remaining gaps below are minor and deployment-related, not code-level.

### Previously Reported as Gaps — Now Confirmed IMPLEMENTED

Before listing the real remaining gaps, here's what was **wrongly flagged** in the initial review and is actually present in your code:

| Previously Flagged Gap | Actual Status | Where It Lives |
|---|---|---|
| Webhook/IPN Listener | **FULLY IMPLEMENTED** | `bkash_sns.py` (SNS parsing + signature verification), `bkash_views.py:466-673` (full webhook endpoint), `tasks.py:139-150` (async processing) |
| Refund API | **FULLY IMPLEMENTED** | `bkash_service.py:667-781` (refund with validation, double-refund prevention, auto-downgrade on full refund) |
| Search Transaction API | **FULLY IMPLEMENTED** | `bkash_service.py:505-515` (search by trxID, used as webhook fallback) |
| Error Code `2029` Handling | **EXPLICITLY HANDLED** | `bkash_service.py:55` — `ALREADY_PROCESSED_CODES = {"2029"}`, checked in `_looks_already_processed()` |
| Stale Payment Cleanup | **FULLY IMPLEMENTED** | `tasks.py:153-189` — Celery task `expire_stale_bkash_transactions()` expires INITIATED payments after 24 hours, queries bKash first |
| CSRF on Webhook | **HANDLED** | `bkash_views.py:466` — `@csrf_exempt` decorator on `bkash_webhook_view` |
| Production Env Template | **COMPLETE** | `.env.production.example:78-89` includes `BKASH_BASE_URL`, `BKASH_CALLBACK_TRUSTED_IPS`, `BKASH_WEBHOOK_URL`, `BKASH_WEBHOOK_TOPIC_ARN` |
| Refund Model Fields | **COMPLETE** | `models.py:103-107, 141-153` — `RefundStatus` enum, `refund_amount`, `refund_reason`, `refund_sku`, `refund_trx_id`, `refund_requested_at`, `refunded_at`, `refund_response` |
| `BKASH_REFUNDED` Event Type | **EXISTS** | `models.py:174` — `SubscriptionEvent.EventType.BKASH_REFUNDED` |

---

### Actual Remaining Gaps

### 3.1 MEDIUM — `BKASH_CALLBACK_TRUSTED_IPS` Needs Actual Values at Deployment

**Current state:** The setting exists in `.env.production.example` and the code fully supports IP allowlisting with CIDR range matching (`client_ip.py:21-46`). However, the value is **blank by default**. When empty, the callback handler logs a warning but **allows all IPs through**:

```python
# bkash_views.py:360-366
else:
    log_audit_event(
        "bkash_callback_allowlist_unconfigured",
        outcome="warning",
        ...
    )
```

**Risk:** Without actual IP values, anyone who discovers your callback URL could send requests to it. Your `sync_transaction()` still verifies with bKash's Execute/Query API (preventing false activations), so this is defense-in-depth rather than a single point of failure. But bKash may ask about it during UAT.

**Action:** During onboarding, ask the bKash team for their callback source IP ranges and configure the environment variable. The code is ready — it just needs the data.

### 3.2 MEDIUM — `BKASH_WEBHOOK_TOPIC_ARN` Needs Actual Value at Deployment

**Current state:** The webhook endpoint uses `settings.BKASH_WEBHOOK_TOPIC_ARN` to validate the SNS Topic ARN in incoming messages (`bkash_views.py:473`). The `.env.production.example` has it as empty. When empty, the ARN check is skipped (the `verify_sns_message_signature` function only enforces it if `expected_topic_arn` is non-empty).

**Risk:** Without a configured Topic ARN, your webhook would accept SNS messages from any topic, not just bKash's. An attacker with a valid AWS account could theoretically send crafted SNS messages to your webhook endpoint. The signature verification still protects you (the message must be signed by AWS), but ARN pinning adds specificity.

**Action:** During onboarding, get the SNS Topic ARN from bKash and set `BKASH_WEBHOOK_TOPIC_ARN` in production.

### 3.3 MEDIUM — No Agreement/Tokenized Payment Support

**Current state:** You use Mode `0011` (standard checkout URL-based). This means every payment requires the customer to enter their **wallet number + OTP + PIN** each time.

**What you're missing:** Modes `0000` (create agreement) and `0001` (tokenized payment using agreement) would allow returning customers to pay with just their **PIN** — skipping wallet number and OTP on repeat payments.

**Impact:** **Not a blocker** for approval. But bKash may ask why you chose not to implement tokenized agreements, especially for a subscription/recurring payment product where users pay monthly/yearly. Be ready to explain your reasoning (see Q&A section).

**If you want to add it later**, you would need:
- An `agreementID` field on `UserSubscription`
- A "Create Agreement" flow (mode `0000`)
- A "Pay with Agreement" flow (mode `0001`) for renewals
- Agreement status query and cancellation endpoints

### 3.4 LOW — No Admin-Facing Refund Trigger Endpoint

**Current state:** The `BkashService.refund_payment()` method is fully implemented with all validations (amount checks, double-refund prevention, auto-downgrade on full refund). However, there is **no REST API endpoint or Django admin action** that allows an admin to trigger a refund from the UI.

**Current workaround:** Refunds can be triggered from Django shell or a management command by calling `BkashService.refund_payment(payment_id, amount=..., reason=...)`.

**Impact:** Not a UAT blocker — bKash tests that the refund API call works, not that you have a UI for it. But for operational convenience, consider adding an admin action.

### 3.5 LOW — Webhook Endpoint Not Registered with bKash Yet

**Current state:** Your webhook endpoint is coded, deployed, and ready at `POST /api/payments/bkash/webhook/`. But it needs to be **registered with bKash's technical support** during onboarding so they can set up the AWS SNS subscription to your endpoint.

**Action:** During onboarding, share your webhook URL with bKash. They will send a `SubscriptionConfirmation` message, which your code auto-confirms (`bkash_sns.py:105-115`). After that, notifications will flow automatically.

---

## 4. Risk Priority Matrix

| # | Gap | Severity | Likely UAT Blocker? | Effort to Fix |
|---|---|---|---|---|
| 3.1 | `BKASH_CALLBACK_TRUSTED_IPS` needs actual IP values | **MEDIUM** | Will be reviewed | Config-only (get IPs from bKash) |
| 3.2 | `BKASH_WEBHOOK_TOPIC_ARN` needs actual value | **MEDIUM** | May be asked about | Config-only (get ARN from bKash) |
| 3.3 | No Agreement/Tokenized flow (mode 0000/0001) | **MEDIUM** | Will be questioned, not a blocker | Optional (2-3 days if needed) |
| 3.4 | No admin UI for triggering refunds | **LOW** | No — refund logic works, just no UI | 0.5 day |
| 3.5 | Webhook URL not yet registered with bKash | **LOW** | Handled during onboarding | 5 minutes (share URL with bKash) |

**Bottom line:** There are **no critical code gaps**. All remaining items are deployment configuration (get values from bKash during onboarding) or optional enhancements.

---

## 5. Likely Questions from bKash Developer Team & Suggested Answers

### Q1: "How do you manage the Grant Token? Are you generating a new token for every API call?"

**Answer:**
> "No, we cache the `id_token` in our Redis-backed Django cache with a TTL of `expires_in - 60 seconds` (approximately 59 minutes for the standard 1-hour token). Every API call first checks the cache. If a valid token exists, it's reused. We only call the Grant Token API when the cache is empty or expired. Additionally, our `_authorized_request()` method has an automatic retry mechanism — if any API call gets an authentication error (HTTP 401/403 or status codes 2001/2002/2011/2023), it automatically refreshes the token using the Refresh Token API and retries the request once. If the refresh token has also expired (28-day lifetime), it falls back to a fresh Grant Token call. This ensures we stay well within bKash's rate limit of 2 Grant Token calls per hour."

**Code reference:** `bkash_service.py:100-392`

---

### Q2: "How do you handle the case where the Execute Payment API times out or doesn't respond?"

**Answer:**
> "We have a dedicated fallback mechanism. When the Execute Payment API returns a response indicating the payment was already processed (containing words like 'already', 'duplicate', or 'processing'), our system raises a `BkashExecutionFallbackRequired` exception. This triggers an automatic call to the Query Payment API (`/tokenized/checkout/payment/status`) to check the actual transaction status. The `verify_payment()` method orchestrates this: it first tries Execute, and if that fails with an 'already processed' indicator, it queries the payment status and normalizes the response. We also have a separate `BkashPaymentStatusView` endpoint that authenticated users can poll, which also triggers `sync_transaction()` for any payment still in `INITIATED` status."

**Code reference:** `bkash_service.py:449-491`

---

### Q3: "How do you verify that a payment is genuinely completed before activating the subscription?"

**Answer:**
> "We never trust the browser callback alone. When bKash redirects the user's browser to our callback URL with `status=success`, our callback handler calls `sync_transaction()` which internally calls `verify_payment()`. This method calls bKash's Execute Payment API from our backend. We only activate the subscription if the response has `statusCode` in `{'0000', '000', '0'}` AND contains a `trxID`. If Execute returns an 'already processed' response, we fall back to Query Payment and check `transactionStatus === 'Completed'`. The actual subscription activation happens inside a `transaction.atomic()` block with `select_for_update()` to prevent race conditions. We double-check the transaction hasn't already been completed before processing."

**Code reference:** `bkash_service.py:524-593` and `bkash_views.py:301-315`

---

### Q4: "Where do you store your bKash credentials? Are they committed to your code repository?"

**Answer:**
> "All bKash credentials (`BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`) are stored as environment variables, never in source code. Our `settings.py` reads them via `os.environ.get()`. We have a `.env.production.example` file in the repository that contains only empty placeholders for documentation purposes — no actual credentials. The `.env` files with real credentials are in `.gitignore`. In production, credentials are injected via the server's environment configuration."

**Code reference:** `questizsurvey/settings.py` (BKASH_* settings), `.env.production.example:78-84`

---

### Q5: "Do you validate the source of callback requests? How do you prevent fake callbacks?"

**Answer:**
> "We have multiple layers of callback security:
> 1. **IP Allowlist:** We support configuring `BKASH_CALLBACK_TRUSTED_IPS` which validates the source IP of callback requests using both exact IP and CIDR range matching. When configured, requests from non-whitelisted IPs are rejected with an audit log entry.
> 2. **Rate Limiting:** Callbacks are rate-limited to 30 attempts per hour per source IP to prevent brute-force attacks.
> 3. **Server-side Verification:** Even if a callback passes IP validation, we NEVER trust it alone. We always call bKash's Execute/Query Payment API from our backend to verify the payment status directly with bKash. A fake callback with `status=success` would be caught because bKash's API would not confirm the payment.
> 4. **Payment ID Validation:** We verify that the `paymentID` in the callback corresponds to an existing transaction in our database.
> 5. **Audit Logging:** Every callback — whether successful, rejected, or failed — is logged with full details including IP, payment ID, status, and rejection reason."

**Code reference:** `bkash_views.py:242-381`, `client_ip.py:21-46`

---

### Q6: "Do you have a webhook/IPN endpoint to receive server-to-server notifications?"

**Answer:**
> "Yes, we have a fully implemented webhook endpoint at `POST /api/payments/bkash/webhook/`. It handles AWS SNS messages with the following capabilities:
>
> 1. **SNS Subscription Confirmation:** When bKash/AWS sends a `SubscriptionConfirmation` message, our endpoint automatically validates the `SubscribeURL` (must be HTTPS on `.amazonaws.com`) and confirms the subscription. This is a one-time setup step.
>
> 2. **Signature Verification:** Every incoming SNS message is cryptographically verified before processing. We validate the `SigningCertURL` (must be HTTPS, `.amazonaws.com` domain, `.pem` extension), download the certificate, and verify the RSA signature against the canonical message string using SHA-1 or SHA-256 depending on the `SignatureVersion`. We also optionally validate the `TopicArn` against our configured `BKASH_WEBHOOK_TOPIC_ARN`.
>
> 3. **Notification Processing:** For `Notification` messages, we extract the payment ID, transaction ID, and invoice number from the nested payload (supporting multiple field name variants like `paymentID`/`paymentId`, `trxID`/`trxId`/`transactionId`). If only a `trxID` is present (no `paymentID`), we use our Search Transaction API as a fallback to resolve it. We then match it to our database record and process it asynchronously via a Celery task.
>
> 4. **Idempotent Processing:** The webhook handler calls the same `sync_transaction()` method used by our callback and polling endpoints, which is fully idempotent — if a transaction is already `COMPLETED`, it returns immediately without double-processing.
>
> All webhook events are logged to our structured audit trail with full details."
>
> **Code reference:** `bkash_sns.py` (SNS verification), `bkash_views.py:466-673` (webhook endpoint), `tasks.py:139-150` (async processing)

---

### Q7: "Do you support refunds? How does your refund process work?"

**Answer:**
> "Yes, refunds are fully implemented. Our `BkashService.refund_payment()` method handles the complete refund lifecycle:
>
> 1. **Validation:** We verify the transaction exists, is in `COMPLETED` status, has not already been refunded (prevents double-refunds), and has a valid `trxID`. We validate that the refund amount is greater than zero and does not exceed the original payment amount.
>
> 2. **API Call:** We call bKash's `/tokenized/checkout/payment/refund` endpoint with `paymentID`, `trxID`, `amount`, `sku`, and `reason`. The request uses the same authenticated request flow with automatic token refresh.
>
> 3. **Status Tracking:** Our `BkashTransaction` model has full refund tracking fields: `refund_status` (NONE/PENDING/COMPLETED/FAILED), `refund_amount`, `refund_reason`, `refund_sku`, `refund_trx_id`, `refund_requested_at`, `refunded_at`, and a `refund_response` JSON field storing the sanitized bKash response.
>
> 4. **Auto-Downgrade:** If a full refund is completed (refund amount equals the original payment amount), the system automatically downgrades the user's subscription to the Free plan and records a `BKASH_REFUNDED` subscription event with metadata.
>
> 5. **Atomicity:** The entire refund update (including the optional downgrade) is wrapped in `transaction.atomic()` with `select_for_update()` to prevent race conditions.
>
> Both partial and full refunds are supported."
>
> **Code reference:** `bkash_service.py:667-781`, `models.py:103-107, 141-153`

---

### Q8: "How do you handle duplicate transactions?"

**Answer:**
> "We handle duplicate prevention at multiple levels:
> 1. **Unique Invoice Number:** Every payment gets a unique `merchantInvoiceNumber` (`QTZ-BK-{timestamp}-{random_hex}`) with a database `unique=True` constraint, so duplicate creates are impossible.
> 2. **Unique Payment ID:** The `payment_id` field also has a `unique=True` database constraint.
> 3. **Explicit Error Code `2029` Handling:** We have `ALREADY_PROCESSED_CODES = {"2029"}` as a class constant. Our `_looks_already_processed()` method checks both this status code AND string patterns ('already', 'duplicate', 'processing') in the response. When detected, instead of failing, it triggers an automatic Query Payment fallback to get the actual status.
> 4. **Idempotent Activation:** Our `sync_transaction()` method checks if a transaction is already `COMPLETED` before processing and returns early if so, preventing double-activation.
> 5. **Atomic Locking:** All state mutations use `transaction.atomic()` with `select_for_update()` to prevent race conditions."

---

### Q9: "What happens if the user's subscription is already active and they try to pay again?"

**Answer:**
> "We have comprehensive checkout validation in `validate_bkash_checkout_request()`:
> - If the user has an active **Stripe** subscription, the bKash checkout is blocked with a message to manage billing through Stripe first.
> - If the user has an active **bKash** subscription for the **same plan and cycle**, they can only renew within a 7-day window before the current period ends.
> - If the user has an active bKash subscription but wants a **different plan/cycle**, they're told to wait until the current term ends.
> - This validation runs twice — before calling bKash's Create Payment API and again after, inside an atomic block — to handle race conditions where the subscription state changes during the bKash API call."

**Code reference:** `services.py:240-283`

---

### Q10: "How do you handle the transition from sandbox to production?"

**Answer:**
> "Our architecture makes the sandbox-to-production switch a configuration change only:
> - The `BKASH_BASE_URL` environment variable determines the target environment. In development/testing, it defaults to `https://tokenized.sandbox.bka.sh/v1.2.0-beta`. For production, we set it to `https://tokenized.pay.bka.sh/v1.2.0-beta`.
> - All four credentials (`APP_KEY`, `APP_SECRET`, `USERNAME`, `PASSWORD`) are swapped via environment variables.
> - The `_require_configuration()` method validates that all required settings are present before any API call, so the system won't silently use incomplete credentials.
> - Our callback URL is built dynamically from `API_ORIGIN`, which changes per environment.
> - We have comprehensive unit and integration tests with mocked bKash responses."

---

### Q11: "Do you log API interactions for debugging and reconciliation?"

**Answer:**
> "Yes, extensively:
> - **Structured Audit Logging:** Every payment event (checkout, callback, status check) is logged via our `log_audit_event()` function as structured JSON. Each log entry includes the event type, outcome (success/failure/rejected), actor user ID, IP address, request path, payment ID, and failure reason.
> - **Transaction Response Storage:** Each `BkashTransaction` record stores the sanitized bKash API response as a JSON field, so we have a record of what bKash returned at each step.
> - **Subscription Events:** The `SubscriptionEvent` model creates an immutable audit trail of every state change (activation, cancellation, downgrade) with metadata including previous state, payment ID, and invoice number.
> - **Sensitive Data Redaction:** All stored responses have `id_token`, `refresh_token`, `customerMsisdn`, and other sensitive fields redacted before persistence."

---

### Q12: "What is the user journey from your application? Walk us through the payment flow."

**Answer:**
> "1. User visits our Pricing page, selects a plan and billing cycle (monthly/yearly), and clicks 'Pay with bKash'.
> 2. Our frontend sends `POST /api/payments/bkash/create/` with `plan_id` and `billing_cycle` (authenticated request).
> 3. Backend validates: user is authenticated, plan exists and is active, BDT price is configured, and no conflicting active subscription exists (checked atomically).
> 4. Backend calls bKash Create Payment API from server-side with the amount, currency (BDT), callback URL, and unique invoice number.
> 5. Backend creates a `BkashTransaction` record in `INITIATED` status and returns the `bkashURL` to the frontend.
> 6. Frontend redirects the user to the `bkashURL` — bKash's hosted checkout page.
> 7. User enters wallet number, OTP, and PIN on bKash's page.
> 8. bKash redirects user's browser back to our callback URL with `paymentID` and `status`.
> 9. Callback handler verifies the payment by calling Execute Payment API (with Query Payment fallback), activates the subscription atomically, and redirects user to our success/failure page.
> 10. Success page polls our status endpoint for up to 5 attempts to confirm activation."

---

### Q13: "How do you handle network failures during payment processing?"

**Answer:**
> "We handle network failures at multiple levels:
> - **30-second timeout:** All bKash API calls have a 30-second timeout as recommended by bKash.
> - **URLError handling:** If the network is unreachable, we raise a clear 'Could not reach the bKash payment gateway' error.
> - **Execute timeout fallback:** If Execute Payment times out or returns ambiguous status, we fall back to Query Payment API to check the actual status.
> - **User-initiated sync:** Users can poll our `BkashPaymentStatusView` which calls `sync_transaction()` to re-verify with bKash.
> - **Graceful frontend handling:** The frontend shows appropriate error messages and allows users to check payment status."

---

### Q14: "Can you show us your test coverage for bKash integration?"

**Answer:**
> "We have comprehensive test coverage in `backend/subscriptions/tests.py` (500+ lines):
> - **Token Management Tests:** Grant token, token caching, token refresh, refresh fallback to grant
> - **Payment Flow Tests:** Create payment, execute payment, query payment, verify payment with fallback
> - **Error Handling Tests:** API errors, network errors, auth failures, duplicate detection
> - **Integration Tests:** Full checkout flow with mocked bKash API responses using Python's `unittest.mock` to patch `urllib.request.urlopen`
> - All tests are automated and run as part of our CI pipeline."

---

## 6. Technical UAT Checklist

Based on bKash's 6-step onboarding process, here's what they'll check:

| # | Check Item | Your Status | Action Needed |
|---|---|---|---|
| 1 | Credentials stored securely (not in source code) | **PASS** | None |
| 2 | Token reuse (not per-request) | **PASS** | None |
| 3 | Correct API flow (Create → Execute → Query fallback) | **PASS** | None |
| 4 | Callback URL is HTTPS | **PASS** | None |
| 5 | Server-side payment verification (don't trust callback alone) | **PASS** | None |
| 6 | Error handling for all status codes | **PASS** (general) | Add explicit `2029` handling |
| 7 | Webhook/IPN endpoint | **FAIL** | Implement SNS listener |
| 8 | Refund API working | **FAIL** | Implement refund endpoint |
| 9 | Search Transaction API | **FAIL** | Implement search by trxID |
| 10 | User journey completeness (end-to-end) | **PASS** | None |
| 11 | Sandbox testing completed | **PASS** (assumed) | Verify with bKash portal |
| 12 | Production readiness (env switch) | **PASS** | Confirm production credentials |

---

## 7. Recommendations for Go-Live

### Must-Do Before UAT (Blockers)

1. **Implement Webhook/IPN Listener**
   - Create `POST /api/payments/bkash/webhook/` endpoint
   - Handle AWS SNS `SubscriptionConfirmation` and `Notification` messages
   - Verify SNS message signatures before processing
   - Share the endpoint URL with bKash during onboarding
   - Make it idempotent (reuse `sync_transaction()`)

2. **Implement Refund API**
   - Add `refund_payment(payment_id, trx_id, amount, reason)` to `BkashService`
   - Add refund status tracking (add `REFUNDED` to `BkashTransaction.Status`)
   - Create admin-facing refund endpoint or admin action
   - Test with sandbox

3. **Implement Search Transaction API**
   - Add `search_transaction(trx_id)` to `BkashService`
   - Useful for reconciliation and webhook processing

4. **Configure `BKASH_CALLBACK_TRUSTED_IPS`**
   - Get bKash's callback source IP ranges during onboarding
   - Add to `.env.production.example` as documentation
   - Configure in production environment

### Should-Do (Recommended)

5. **Add explicit error code `2029` handling** — Trigger Query Payment fallback
6. **Add stale payment cleanup task** — Expire `INITIATED` transactions after 24 hours via Celery
7. **Add `BKASH_BASE_URL` to `.env.production.example`** with production URL comment
8. **Consider Agreement/Tokenized flow** for better UX on renewals (PIN-only after first payment)

### Nice-to-Have

9. **Payment reconciliation report** — Admin view comparing your records with bKash Search API
10. **Retry queue for failed webhooks** — Store unprocessable notifications for manual review

---

*This report was prepared by auditing the codebase against bKash's official developer documentation (https://developer.bka.sh/docs), API reference, and the Tokenized Checkout integration guide.*
