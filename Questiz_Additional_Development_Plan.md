# Questiz: Additional Features Development Plan

> Extends the completed Phase 1-9 foundation.
> Adds admin panel, subscription plans, payments, email verification, enhanced profiles, access control, and AI features.

---

## Feature Overview

| # | Feature | Summary |
|---|---------|---------|
| 1 | User Profile Enhancement | Add missing fields: photo, organization, designation, phone |
| 2 | Email Verification | Complete email verification flow with admin toggle |
| 3 | Subscription Plans & Licensing | Free/Pro/Enterprise tiers with usage limits |
| 4 | Payment Integration — Stripe | Recurring subscriptions via Stripe Checkout |
| 5 | Payment Integration — Bkash | Recurring subscriptions via Bkash Payment Gateway |
| 6 | Frontend Admin Panel | Admin dashboard for users, licenses, and payments |
| 7 | Survey Access Control | "Logged in users only" survey setting |
| 8 | AI Integration — Question Improver | AI-powered question text improvement in builder |
| 9 | AI Integration — Insights Chat | Conversational AI analytics in the Analyze page |

---

## Phase 1: User Profile Enhancement

> Add missing profile fields to the User model and update frontend.

### Step 1.1 — User Model Updates

```
Modify accounts/models.py User model. Add fields:

- organization (CharField max_length=255, blank=True, default="")
- designation (CharField max_length=255, blank=True, default="")
- phone (CharField max_length=30, blank=True, default="")

The model already has: first_name, last_name (from AbstractUser), email,
bio, avatar (as ImageField). These are sufficient for the photo and basic
info requirements.

Run makemigrations and migrate.
```

### Step 1.2 — Serializer & API Updates

```
Update accounts/serializers.py:

- UserSerializer: Add organization, designation, phone to fields list.
- UserUpdateSerializer: Add organization, designation, phone to fields
  list so users can update them.
- UserRegistrationSerializer: Optionally add organization as a field
  (not required).

No new endpoints needed — the existing GET /api/auth/user/ and
PATCH /api/auth/profile/ endpoints already serve these serializers.
```

### Step 1.3 — Frontend Profile Page Redesign

```
Redesign frontend/src/pages/Profile.jsx:

Layout — use a two-column card layout:

Left column (1/3 width):
- Avatar upload with circular preview and camera icon overlay
  (use existing avatar ImageField). Click to open file picker.
  POST the file as multipart/form-data to PATCH /api/auth/profile/.
- User's full name below the avatar
- Current plan badge (e.g., "Free Plan" — read from user.plan,
  added in Phase 3)
- Member since date

Right column (2/3 width):
- Form fields in a clean grid:
  Row 1: First Name | Last Name
  Row 2: Email (read-only or with change flow) | Phone
  Row 3: Organization | Designation
  Row 4: Bio (full width textarea)
- Save button at bottom

Use shadcn Card, Input, Textarea, Button, Avatar components.
Use react-hook-form for form management.
Show toast on successful save via sonner.
```

---

## Phase 2: Email Verification

> Complete the email verification flow. Admin can enable/disable it globally.

### Step 2.1 — Backend: Verification Model & Logic

```
Add to accounts/models.py User model:
- email_verified (BooleanField, default=False)

Create accounts/models.py (or a new file accounts/email_verification.py):
- EmailVerificationToken model:
  - id (UUIDField, primary key)
  - user (FK to User, CASCADE)
  - token (CharField max_length=64, unique, default=generate random token)
  - created_at (DateTimeField, auto_now_add)
  - expires_at (DateTimeField, default=24 hours from now)
  - used (BooleanField, default=False)

Create a SiteSettings singleton model (or use Django's built-in Sites
framework with a custom model). Place in a new app or in accounts:

- SiteSettings model (singleton — only one row):
  - require_email_verification (BooleanField, default=True)
  - logged_in_users_only_default (BooleanField, default=False)
    (used in Phase 7)
  - ai_provider (CharField choices: "openai"/"anthropic",
    default="openai") (used in Phase 8-9)
  - ai_api_key_openai (CharField, blank, encrypted or stored in env)
  - ai_api_key_anthropic (CharField, blank, encrypted or stored in env)

  Register in Django admin with a custom admin class that prevents
  adding more than one row (singleton pattern).

Run makemigrations and migrate.
```

### Step 2.2 — Backend: Verification Endpoints

```
Create accounts/views.py new endpoints:

POST /api/auth/send-verification-email/
  - Requires authentication
  - Generates an EmailVerificationToken for request.user
  - Sends an email with a verification link:
    {PUBLIC_APP_URL}/verify-email?token={token}
  - Rate limit: max 1 email per 2 minutes per user

GET /api/auth/verify-email/?token={token}
  - No auth required
  - Validates the token exists, is not expired, not used
  - Sets user.email_verified = True
  - Marks token as used
  - Returns success response

Modify RegisterView.create():
  - After user creation, check SiteSettings.require_email_verification
  - If enabled, send verification email automatically
  - Return a flag in the response: { email_verification_required: true }

Modify login_view():
  - After successful auth, check if email_verified is False AND
    SiteSettings.require_email_verification is True
  - If so, return 403 with: {
      detail: "Please verify your email before logging in.",
      email_verification_required: true,
      email: user.email (partially masked)
    }
  - Include a "resend" suggestion in the response

Create email template: accounts/templates/emails/verify_email.html
  - Clean, responsive HTML email
  - Contains: Questiz logo, greeting, verification button/link,
    expiry notice (24 hours), footer
```

### Step 2.3 — Frontend: Verification Flow

```
Create frontend/src/pages/VerifyEmail.jsx:
  - Route: /verify-email
  - On mount, reads ?token= from URL params
  - Calls GET /api/auth/verify-email/?token={token}
  - Shows success state: "Email verified! You can now log in."
    with a link to /login
  - Shows error state: "Invalid or expired link. Please request
    a new verification email."

Update frontend/src/pages/Register.jsx:
  - After successful registration, if response.email_verification_required
    is true, show a "Check your email" screen instead of auto-login
  - Include a "Resend verification email" button

Update frontend/src/pages/Login.jsx:
  - If login returns 403 with email_verification_required:
    - Show a message: "Please verify your email first"
    - Show a "Resend verification email" button that calls
      POST /api/auth/send-verification-email/ (needs a special
      endpoint that accepts email+password instead of JWT for
      this case, or a separate public resend endpoint)

Add route /verify-email to App.jsx router.
```

---

## Phase 3: Subscription Plans & Licensing System

> Introduce Free/Pro/Enterprise tiers with usage-based limits configured from Django admin.

### Step 3.1 — Plan Model

```
Create a new Django app: subscriptions
(or add models to accounts app — recommend a new app for separation)

python manage.py startapp subscriptions

Models in subscriptions/models.py:

Plan model:
  - id (UUIDField, primary key)
  - name (CharField max_length=50, unique) — "Free", "Pro", "Enterprise"
  - slug (SlugField, unique) — "free", "pro", "enterprise"
  - tier (PositiveIntegerField, unique) — 0, 1, 2 (for ordering/comparison)
  - max_surveys (PositiveIntegerField, default=0)
    — 0 means unlimited
  - max_questions_per_survey (PositiveIntegerField, default=0)
    — 0 means unlimited
  - max_responses_per_survey (PositiveIntegerField, default=0)
    — 0 means unlimited
  - price_monthly (DecimalField max_digits=10 decimal_places=2, default=0)
  - price_yearly (DecimalField max_digits=10 decimal_places=2, default=0)
  - stripe_price_id_monthly (CharField, blank, null)
  - stripe_price_id_yearly (CharField, blank, null)
  - bkash_price_monthly (DecimalField, default=0) — price in BDT
  - bkash_price_yearly (DecimalField, default=0) — price in BDT
  - currency (CharField, default="USD") — for Stripe
  - is_active (BooleanField, default=True)
  - features (JSONField, default=list) — list of feature strings
    for display, e.g., ["Unlimited surveys", "PDF export", "AI insights"]
  - created_at, updated_at

  Meta: ordering = ['tier']

  Register in Django admin with list_display =
    [name, tier, max_surveys, max_questions_per_survey,
     max_responses_per_survey, price_monthly, price_yearly, is_active]

UserSubscription model:
  - id (UUIDField, primary key)
  - user (OneToOneField to User, CASCADE, related_name='subscription')
  - plan (FK to Plan, PROTECT)
  - status (CharField choices: active/cancelled/past_due/trialing,
    default='active')
  - billing_cycle (CharField choices: monthly/yearly, default='monthly')
  - payment_provider (CharField choices: stripe/bkash/none, default='none')
  - stripe_customer_id (CharField, blank, null)
  - stripe_subscription_id (CharField, blank, null)
  - bkash_subscription_id (CharField, blank, null)
  - current_period_start (DateTimeField, null, blank)
  - current_period_end (DateTimeField, null, blank)
  - created_at, updated_at

  Register in Django admin.

Run makemigrations and migrate.

Create a data migration to seed the 3 default plans:
  - Free: tier=0, max_surveys=3, max_questions=10, max_responses=50,
    price=0
  - Pro: tier=1, max_surveys=25, max_questions=50, max_responses=1000,
    price_monthly=29, price_yearly=290
  - Enterprise: tier=2, max_surveys=0 (unlimited), max_questions=0,
    max_responses=0, price_monthly=99, price_yearly=990

(Admin can change these values from Django admin panel at any time.)
```

### Step 3.2 — License Enforcement

```
Create subscriptions/services.py with a LicenseService class:

Methods:

get_user_plan(user) -> Plan:
  Returns the user's current plan. If no UserSubscription exists,
  returns the Free plan (auto-create the subscription record).

check_can_create_survey(user) -> (bool, str):
  Count user's surveys (Survey.objects.filter(user=user).count()).
  IMPORTANT: Count ALL surveys including deleted=False ones.
  Deleting a survey DOES free up a slot (count only existing surveys).
  Compare against plan.max_surveys (0 = unlimited).
  Return (True, "") or (False, "You've reached the maximum of
  {N} surveys on the {Plan} plan. Upgrade to create more.")

check_can_add_question(survey) -> (bool, str):
  Count questions in the survey across all pages.
  Compare against plan.max_questions_per_survey.
  Return appropriate message.

check_can_accept_response(survey) -> (bool, str):
  Count completed responses for this survey.
  Compare against plan.max_responses_per_survey.
  Return appropriate message.

Integrate enforcement into existing views:

- surveys/views/survey_views.py SurveyViewSet.create():
  Before creating, call check_can_create_survey(). If False,
  return 403 with the message and a "plan_limit" error code.

- surveys/views/question_views.py QuestionViewSet.create():
  Before creating, call check_can_add_question(). If False,
  return 403.

- surveys/views/response_views.py (public submission):
  Before accepting a response, call check_can_accept_response().
  If False, return 403 with "This survey has reached its response
  limit."

Note: Deleting a survey reduces the count, so the user can create
new surveys after deletion. The enforcement only counts currently
existing surveys, NOT a lifetime total.
```

### Step 3.3 — Subscription API Endpoints

```
Create subscriptions/serializers.py:
- PlanSerializer (id, name, slug, tier, max_surveys,
  max_questions_per_survey, max_responses_per_survey,
  price_monthly, price_yearly, currency, features, is_active)
- UserSubscriptionSerializer (id, plan (nested PlanSerializer),
  status, billing_cycle, payment_provider, current_period_start,
  current_period_end)

Create subscriptions/views.py:

GET /api/plans/ — list all active plans (public, no auth required)
GET /api/subscription/ — get current user's subscription + plan
GET /api/subscription/usage/ — returns current usage stats:
  {
    surveys: { used: 2, limit: 3, unlimited: false },
    questions_per_survey: { limit: 10, unlimited: false },
    responses_per_survey: { limit: 50, unlimited: false },
    plan: { name: "Free", tier: 0 }
  }

Wire routes in subscriptions/urls.py, include in project urls.py.

Update accounts/serializers.py UserSerializer to include:
- current_plan (nested: { name, slug, tier }) from subscription

Register subscriptions app in INSTALLED_APPS.
```

### Step 3.4 — Frontend: Plan Display & Upgrade UI

```
Create frontend/src/pages/Pricing.jsx:
  - Route: /pricing
  - Fetch plans from GET /api/plans/
  - Display 3-column pricing cards (Free / Pro / Enterprise)
  - Each card shows: plan name, price (monthly/yearly toggle),
    feature list, usage limits, CTA button
  - Free card: "Current Plan" if on free, otherwise "Downgrade"
  - Paid cards: "Upgrade" button → links to checkout (Phase 4/5)
  - Billing cycle toggle: Monthly / Yearly (show savings for yearly)
  - Use shadcn Card, Badge, Button, Switch components

Create frontend/src/components/subscription/UsageBanner.jsx:
  - Shown on SurveyDashboard when approaching limits
  - "You've used 2 of 3 surveys on the Free plan. Upgrade for more."
  - Progress bar showing usage percentage
  - "Upgrade" link to /pricing

Create frontend/src/components/subscription/PlanBadge.jsx:
  - Small badge component showing current plan name + color
  - Used in Navbar, Profile page, Admin panel

Update Profile.jsx to show current plan badge and "Manage Plan" link.
Update SurveyDashboard to show UsageBanner when usage > 70%.

Create frontend/src/services/subscriptions.js:
  - getPlans(), getSubscription(), getUsage() API calls
```

---

## Phase 4: Payment Integration — Stripe

> Recurring subscriptions via Stripe Checkout + Customer Portal.

### Step 4.1 — Stripe Backend Setup

```
Install: pip install stripe

Add to settings.py:
  STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
  STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
  STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

Stripe Dashboard Setup (sandbox mode):
  1. Create a Stripe account, get test API keys
  2. Create Products: "Questiz Pro", "Questiz Enterprise"
  3. Create Prices for each: monthly + yearly recurring
  4. Copy Price IDs into Plan model records via Django admin

Create subscriptions/services/stripe_service.py:

class StripeService:

  create_checkout_session(user, plan, billing_cycle,
    success_url, cancel_url) -> session_url:
    - Creates or retrieves Stripe Customer for the user
      (store stripe_customer_id on UserSubscription)
    - Creates a Stripe Checkout Session in "subscription" mode
    - Uses the plan's stripe_price_id_monthly or
      stripe_price_id_yearly based on billing_cycle
    - Returns the checkout session URL for redirect

  create_customer_portal_session(user, return_url) -> portal_url:
    - Opens Stripe Customer Portal for managing subscription
    - Users can update payment method, cancel, switch plans

  handle_webhook(payload, sig_header) -> None:
    - Verifies webhook signature
    - Handles events:
      * checkout.session.completed → create/update UserSubscription
        (set plan, status=active, billing_cycle, period dates,
         stripe_subscription_id)
      * invoice.paid → update current_period_end
      * invoice.payment_failed → set status=past_due
      * customer.subscription.deleted → downgrade to Free plan
      * customer.subscription.updated → update plan if changed
```

### Step 4.2 — Stripe API Endpoints

```
Create subscriptions/views/stripe_views.py:

POST /api/payments/stripe/create-checkout/
  Body: { plan_id: uuid, billing_cycle: "monthly"|"yearly" }
  - Calls StripeService.create_checkout_session()
  - Returns { checkout_url: "https://checkout.stripe.com/..." }

POST /api/payments/stripe/customer-portal/
  - Calls StripeService.create_customer_portal_session()
  - Returns { portal_url: "https://billing.stripe.com/..." }

POST /api/payments/stripe/webhook/ (AllowAny, exempt from CSRF)
  - Receives Stripe webhook events
  - Calls StripeService.handle_webhook()
  - Returns 200 OK

GET /api/payments/stripe/config/
  - Returns { publishable_key: STRIPE_PUBLISHABLE_KEY }
  (so frontend doesn't hardcode the key)
```

### Step 4.3 — Frontend: Stripe Checkout Flow

```
Install: npm install @stripe/stripe-js

Update the Pricing page "Upgrade" buttons for Stripe:
  1. User clicks "Upgrade to Pro" (monthly)
  2. Frontend POSTs to /api/payments/stripe/create-checkout/
     with { plan_id, billing_cycle: "monthly" }
  3. Redirect to the returned checkout_url (Stripe hosted page)
  4. On success, Stripe redirects to /pricing?success=true
  5. Show success toast and refetch subscription data

Create frontend/src/pages/PaymentSuccess.jsx:
  - Route: /payment/success
  - Shows "Payment successful! Your plan has been upgraded."
  - Redirects to dashboard after 3 seconds

Add "Manage Billing" button on Profile page:
  - Calls /api/payments/stripe/customer-portal/
  - Redirects to Stripe Customer Portal
```

---

## Phase 5: Payment Integration — Bkash

> Recurring subscriptions via Bkash Payment Gateway API.

### Step 5.1 — Bkash Backend Setup

```
Bkash Developer Setup:
  1. Register at Bkash PGW Developer Portal
     (https://developer.bka.sh/)
  2. Get sandbox credentials: app_key, app_secret, username, password
  3. Sandbox base URL: https://tokenized.sandbox.bka.sh/v1.2.0-beta

Add to settings.py:
  BKASH_APP_KEY = os.environ.get("BKASH_APP_KEY", "")
  BKASH_APP_SECRET = os.environ.get("BKASH_APP_SECRET", "")
  BKASH_USERNAME = os.environ.get("BKASH_USERNAME", "")
  BKASH_PASSWORD = os.environ.get("BKASH_PASSWORD", "")
  BKASH_BASE_URL = os.environ.get(
    "BKASH_BASE_URL",
    "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
  )

Create subscriptions/services/bkash_service.py:

class BkashService:

  _grant_token() -> str:
    - POST to {base_url}/tokenized/checkout/token/grant
    - Body: { app_key, app_secret }
    - Headers: { username, password }
    - Returns the id_token (cache for ~3500 seconds / token expiry)

  _refresh_token(refresh_token) -> str:
    - POST to {base_url}/tokenized/checkout/token/refresh
    - Refreshes expired grant token

  create_payment(user, plan, billing_cycle, callback_url) -> dict:
    - POST to {base_url}/tokenized/checkout/create
    - Headers: { Authorization: id_token, X-APP-Key: app_key }
    - Body: {
        mode: "0011",
        payerReference: str(user.id),
        callbackURL: callback_url,
        amount: plan.bkash_price_monthly or bkash_price_yearly,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: generate_invoice_number()
      }
    - Returns { bkashURL, paymentID, ... }
    - User is redirected to bkashURL to authorize payment

  execute_payment(payment_id) -> dict:
    - POST to {base_url}/tokenized/checkout/execute
    - Called after user returns from bkash authorization
    - Returns transaction details (trxID, status, etc.)

  query_payment(payment_id) -> dict:
    - GET to {base_url}/tokenized/checkout/payment/status
    - Query payment status

  For recurring subscription support:
  - After first successful payment, create an agreement using
    Bkash Tokenized (Recurring) API if available
  - If Bkash recurring is not supported in sandbox, implement a
    manual renewal flow:
    * Store subscription end date
    * Send reminder email 3 days before expiry
    * User manually pays again via Bkash
    * Celery task checks for expired subscriptions daily and
      sends renewal reminders

Create subscriptions/models.py — add:

BkashTransaction model:
  - id (UUIDField, primary key)
  - user (FK to User)
  - subscription (FK to UserSubscription, null)
  - payment_id (CharField — Bkash paymentID)
  - trx_id (CharField — Bkash trxID, null, blank)
  - amount (DecimalField)
  - currency (CharField, default="BDT")
  - status (CharField: initiated/completed/failed/cancelled)
  - invoice_number (CharField, unique)
  - bkash_response (JSONField — full response for audit)
  - created_at, updated_at
```

### Step 5.2 — Bkash API Endpoints

```
Create subscriptions/views/bkash_views.py:

POST /api/payments/bkash/create/
  Body: { plan_id: uuid, billing_cycle: "monthly"|"yearly" }
  - Calls BkashService.create_payment()
  - Stores BkashTransaction with status=initiated
  - Returns { bkash_url: "...", payment_id: "..." }

GET /api/payments/bkash/callback/
  Query params: paymentID, status (from Bkash redirect)
  - If status == "success":
    - Calls BkashService.execute_payment(paymentID)
    - Updates BkashTransaction with trxID and status=completed
    - Creates/updates UserSubscription (plan, period dates)
    - Redirects to {PUBLIC_APP_URL}/payment/success?provider=bkash
  - If status == "failure" or "cancel":
    - Updates BkashTransaction status
    - Redirects to {PUBLIC_APP_URL}/payment/failed?provider=bkash

GET /api/payments/bkash/status/{payment_id}/
  - Queries Bkash for payment status (manual check)
```

### Step 5.3 — Frontend: Bkash Checkout Flow

```
Update the Pricing page to show both payment options:

When user clicks "Upgrade":
1. Show a PaymentMethodDialog with two options:
   - Stripe (credit/debit card) — with Stripe logo
   - Bkash (mobile payment) — with Bkash logo
2. If Stripe selected → existing Stripe checkout flow
3. If Bkash selected:
   - POST to /api/payments/bkash/create/
   - Redirect to returned bkash_url (Bkash hosted page)
   - User completes payment on Bkash
   - Bkash redirects to callback → backend processes →
     redirects to /payment/success

Create frontend/src/components/subscription/PaymentMethodDialog.jsx:
  - Modal with two card-style buttons: Stripe | Bkash
  - Each shows the provider logo and accepted payment types
  - Bkash option shows "(BDT)" and converts the USD price display
    to the configured BDT price from the plan

Update PaymentSuccess page to handle ?provider=bkash param.

Create frontend/src/pages/PaymentFailed.jsx:
  - Route: /payment/failed
  - Shows "Payment was not completed" with retry button
```

### Step 5.4 — Subscription Renewal & Management

```
Backend — Celery tasks in subscriptions/tasks.py:

check_expiring_subscriptions():
  - Run daily via Celery Beat
  - Find subscriptions where current_period_end is within 3 days
  - For Stripe: Stripe handles renewal automatically (webhook)
  - For Bkash: Send a renewal reminder email with a payment link

check_expired_subscriptions():
  - Run daily via Celery Beat
  - Find subscriptions past current_period_end with no renewal
  - Grace period: 3 days after expiry
  - After grace period: downgrade to Free plan, set status=cancelled
  - Send downgrade notification email

Frontend — "Manage Subscription" section on Profile page:
  - Shows current plan, billing cycle, next billing date
  - For Stripe: "Manage Billing" button → Stripe Portal
  - For Bkash: "Renew Now" button → triggers new Bkash payment
  - "Cancel Subscription" button (downgrades to Free at period end)
```

---

## Phase 6: Frontend Admin Panel

> Admin dashboard for superusers to manage users, subscriptions, and payments.

### Step 6.1 — Admin Backend APIs

```
Create a new file: accounts/views/admin_views.py
(or subscriptions/views/admin_views.py)

All endpoints require is_superuser=True permission.

GET /api/admin/dashboard/
  Returns summary stats:
  {
    total_users: int,
    users_by_plan: [{ plan_name, count }],
    total_revenue_monthly: decimal,
    total_revenue_yearly: decimal,
    new_users_this_month: int,
    active_surveys: int,
    total_responses: int,
    recent_signups: [last 10 users with plan info],
    revenue_over_time: [{ month, stripe_revenue, bkash_revenue }]
  }

GET /api/admin/users/
  Paginated user list with filters:
  - ?search= (name, email, organization)
  - ?plan= (free, pro, enterprise)
  - ?status= (active, inactive)
  - ?date_from=, ?date_to=
  Returns: user details + subscription + survey count +
    response count + last login

GET /api/admin/users/{user_id}/
  Full user detail with:
  - Profile info
  - Subscription history
  - Payment transactions (Stripe + Bkash)
  - Survey list with response counts
  - Usage stats

PATCH /api/admin/users/{user_id}/
  Admin can update:
  - is_active (enable/disable user)
  - Manually assign a plan (override)

GET /api/admin/payments/
  Paginated payment/transaction list:
  - All Stripe invoices + Bkash transactions
  - Filters: provider, status, date range
  - Shows: user, amount, provider, status, date

GET /api/admin/settings/
PATCH /api/admin/settings/
  - Read/update SiteSettings (email verification toggle,
    AI provider selection, etc.)
```

### Step 6.2 — Admin Frontend: Layout & Dashboard

```
Create frontend/src/pages/admin/AdminLayout.jsx:
  - Route: /admin/* (protected — superuser only)
  - Left sidebar navigation:
    - Dashboard (overview)
    - Users (user management)
    - Payments (transaction history)
    - Plans (links to Django admin for plan config)
    - Settings (site settings)
  - Top bar: "Admin Panel" title, admin user avatar,
    "Back to App" link

Create frontend/src/pages/admin/AdminDashboard.jsx:
  - Route: /admin
  - Summary stat cards: Total Users, Active Subscriptions,
    Monthly Revenue, Total Surveys
  - Charts:
    - User growth line chart (last 12 months)
    - Revenue bar chart by month (Stripe vs Bkash split)
    - Users by plan pie/donut chart
  - Recent signups table (last 10)
  - Recent payments table (last 10)

Use existing chart components (QBarChart, QPieChart, QLineChart)
from src/components/charts/.
```

### Step 6.3 — Admin Frontend: User Management

```
Create frontend/src/pages/admin/AdminUsers.jsx:
  - Route: /admin/users
  - Search bar + filter dropdowns (Plan, Status, Date range)
  - Data table using @tanstack/react-table:
    Columns: Avatar, Name, Email, Organization, Plan (badge),
    Surveys (count), Responses (count), Status, Joined, Actions
  - Sortable by any column
  - Click row → opens user detail slide-over or navigates to detail

Create frontend/src/pages/admin/AdminUserDetail.jsx:
  - Route: /admin/users/:userId
  - User profile card (avatar, name, email, org, designation, phone)
  - Current subscription card (plan, status, billing, next renewal)
  - Usage stats card (surveys used/limit, responses)
  - Payment history table (all transactions for this user)
  - Survey list table (title, status, responses, created)
  - Actions: Activate/Deactivate user, Change plan (dropdown),
    Reset password (sends reset email)
```

### Step 6.4 — Admin Frontend: Payment History

```
Create frontend/src/pages/admin/AdminPayments.jsx:
  - Route: /admin/payments
  - Filter bar: Provider (All/Stripe/Bkash), Status, Date range
  - Data table:
    Columns: Date, User, Plan, Amount, Provider (with logo icon),
    Status (badge), Transaction ID
  - Export to CSV button
  - Summary row at top: Total revenue for filtered period
```

### Step 6.5 — Admin Frontend: Site Settings

```
Create frontend/src/pages/admin/AdminSettings.jsx:
  - Route: /admin/settings
  - Card-based settings form:

    Authentication Settings:
    - "Require email verification" toggle (Switch)

    AI Configuration:
    - AI Provider dropdown (OpenAI / Anthropic)
    - API Key input (password field, show last 4 chars)
    - AI Model selection (e.g., gpt-4o-mini, claude-sonnet-4-6)
    - "Test Connection" button that makes a test API call

    Survey Defaults:
    - "Default: Logged in users only" toggle

  - Save button at bottom
  - Changes update SiteSettings via PATCH /api/admin/settings/

Guard all /admin routes in App.jsx with a superuser check.
Redirect non-superusers to /dashboard.
```

---

## Phase 7: Survey Access Control — "Logged in Users Only"

> Survey hosts can require respondents to be logged in before taking a survey.

### Step 7.1 — Backend

```
Add to Survey model settings JSONField a recognized key:
  settings.require_login (boolean, default=false)

This is already a JSONField, so no migration needed — just
document and handle the key.

Modify the public survey response endpoint
(surveys/views/response_views.py — PublicSurveyView):

On GET /api/surveys/public/{slug}/:
  - Read survey.settings.get('require_login', False)
  - If True and request is not authenticated:
    Return 401 with {
      require_login: true,
      message: "This survey requires you to log in."
    }
  - If True and authenticated: proceed normally, also link the
    response to the authenticated user

On POST (answer submission):
  - Same check: if require_login and not authenticated, reject
  - If authenticated, store user reference on SurveyResponse
    (optional: add a user FK field to SurveyResponse or store
    in respondent_email from user.email)
```

### Step 7.2 — Builder UI

```
Update frontend/src/components/builder/QuestionSettingsPanel.jsx
(or the survey-level settings section of the builder right sidebar):

In the survey settings section (when no question is selected),
add under "Settings" tab:

- "Require login to respond" toggle (Switch)
  Description: "Respondents must log in before taking this survey"

  Saves to survey.settings.require_login via the existing
  auto-save mechanism.
```

### Step 7.3 — Public Survey Page

```
Update frontend/src/pages/surveys/PublicSurveyPage.jsx:

On loading the survey, if the API returns 401 with require_login:
  - Show a login prompt screen:
    Card with Questiz logo, survey title, message:
    "This survey requires you to sign in."
    Two buttons: "Log In" → /login?redirect=/s/{slug}
                 "Register" → /register?redirect=/s/{slug}

Update Login.jsx and Register.jsx:
  - Read ?redirect= query param
  - After successful login/register, redirect to that URL
    instead of /dashboard
```

---

## Phase 8: AI Integration — Question Improver

> Add an AI-powered "Improve" button on each question in the builder.

### Step 8.1 — Backend: Multi-Provider AI Service

```
Refactor backend/surveys/services/ai_insights.py into a
multi-provider architecture:

Create surveys/services/ai_service.py:

class AIService:
  """Unified AI service supporting OpenAI and Anthropic."""

  def __init__(self):
    self.settings = SiteSettings.load()  # singleton
    self.provider = self.settings.ai_provider  # "openai" or "anthropic"

  @property
  def enabled(self):
    if self.provider == "openai":
      return bool(os.environ.get("OPENAI_API_KEY") or
                   self.settings.ai_api_key_openai)
    elif self.provider == "anthropic":
      return bool(os.environ.get("ANTHROPIC_API_KEY") or
                   self.settings.ai_api_key_anthropic)
    return False

  def _call_openai(self, system_prompt, user_prompt,
      response_schema=None) -> str:
    # Use OpenAI Responses API (existing pattern from ai_insights.py)
    # Uses urllib (no SDK dependency)
    ...

  def _call_anthropic(self, system_prompt, user_prompt,
      response_schema=None) -> str:
    # Use Anthropic Messages API: POST https://api.anthropic.com/v1/messages
    # Headers: x-api-key, anthropic-version: 2023-06-01
    # Uses urllib (no SDK dependency)
    ...

  def call(self, system_prompt, user_prompt,
      response_schema=None) -> dict:
    if self.provider == "openai":
      return self._call_openai(system_prompt, user_prompt,
                                response_schema)
    else:
      return self._call_anthropic(system_prompt, user_prompt,
                                   response_schema)

  def improve_question(self, survey_title, question_type,
      question_text) -> dict:
    system_prompt = (
      "You are a survey design expert. Improve the given survey "
      "question to be more engaging, professional, and clear. "
      "Return JSON with 'improved_text' (the improved question) "
      "and 'explanation' (brief reason for changes)."
    )
    user_prompt = (
      f"The user is creating a survey called '{survey_title}'. "
      f"The question type is '{question_type}' and the current "
      f"question text is '{question_text}'. "
      f"Improve this question to make it more engaging and "
      f"professional."
    )
    return self.call(system_prompt, user_prompt)

Update the existing ai_insights.py to use AIService internally
(or merge into the new service).
```

### Step 8.2 — Backend: Improve Question Endpoint

```
Add to surveys/views/question_views.py (or create a new
ai_views.py):

POST /api/surveys/{survey_id}/questions/{question_id}/improve/
  - Requires authentication + survey ownership
  - Reads the question's type and text
  - Reads the survey's title
  - Calls AIService.improve_question(survey_title, question_type,
    question_text)
  - Returns: {
      improved_text: "...",
    }
  - Rate limit: 10 requests per minute per user (to control costs)
```

### Step 8.3 — Frontend: Improve Button in Builder

```
In the survey builder canvas, for each question card
(in the center canvas where questions are displayed):

Add a small "Improve" icon button (Sparkles icon from lucide-react)
next to the question's help/description icon.

On click:
1. Show a loading spinner on the button
2. POST to /api/surveys/{id}/questions/{qId}/improve/
3. On response, show a popover/dialog:
   - "Suggested improvement:"
   - The improved text displayed in a not so highlighted box on just top of the old question so that user can get a vision of easier comparison with the old one. 
   - Two buttons: "Tick" (replaces question text) | "Cross"
4. If "Apply" is clicked:
   - Update the question text in the builder state (zustand)
   - Trigger the auto-save debounce
   - Show toast: "Question improved!"

Also add the same button in the QuestionSettingsPanel right sidebar,
next to the question text Textarea field.
```

---

## Phase 9: AI Integration — Insights Chat

> Conversational AI analytics in the Analyze page with persistent chat history.

### Step 9.1 — Backend: Chat Models & Service

```
Add to surveys/models/ (new file: ai_chat.py):

AIChatSession model:
  - id (UUIDField, primary key)
  - survey (FK to Survey, CASCADE)
  - user (FK to User, CASCADE)
  - title (CharField, default="New Chat" — auto-generated
    from first message)
  - created_at, updated_at

  Meta: ordering = ['-updated_at']
  unique_together = None (users can have multiple sessions per survey)

AIChatMessage model:
  - id (UUIDField, primary key)
  - session (FK to AIChatSession, CASCADE, related_name='messages')
  - role (CharField choices: 'user'/'assistant')
  - content (TextField)
  - created_at

  Meta: ordering = ['created_at']

Run makemigrations and migrate.
```

### Step 9.2 — Backend: Insights & Chat Endpoints

```
Create surveys/services/ai_chat_service.py:

class AIChatService:

  def prepare_survey_context(self, survey_id, filters=None) -> str:
    """
    Build a cost-effective survey context string for the AI.

    Instead of sending raw response data, send a SUMMARY:
    - Survey title, description, total responses, completion rate
    - For each question: question text, type, and aggregated stats
      (from AnalyticsService — reuse existing analytics methods)

    Format as a structured text report that the AI can understand.
    This keeps token usage low while giving the AI enough context.

    Example format:
    '''
    Survey: "Customer Satisfaction Q1 2026" (142 responses, 89% completion)

    Q1 [Multiple Choice]: "How satisfied are you with our service?"
    - Very Satisfied: 45 (31.7%)
    - Satisfied: 52 (36.6%)
    - Neutral: 28 (19.7%)
    - Dissatisfied: 12 (8.5%)
    - Very Dissatisfied: 5 (3.5%)

    Q2 [NPS]: "How likely are you to recommend us?"
    - NPS Score: 42
    - Promoters: 65 (45.8%), Passives: 48 (33.8%), Detractors: 29 (20.4%)
    - Mean: 7.2, Median: 8
    ...
    '''
    """

  def get_generic_insights(self, survey_id) -> dict:
    """
    Generate a one-time generic insight summary for the survey.
    Called when the AI Insights button is clicked on the Analyze page.

    Returns: {
      headline: "...",
      key_findings: ["...", "..."],
      recommendations: ["...", "..."]
    }
    """

  def chat(self, session_id, user_message) -> str:
    """
    Process a chat message in context of the survey data.

    1. Load the chat session and its survey
    2. Build the survey context (prepare_survey_context)
    3. Load recent chat history (last 20 messages for context window)
    4. Construct the prompt:
       - System: "You are an analytics assistant for survey data.
         Answer questions based on the following survey results.
         Be concise, factual, and cite specific numbers."
       - Include the survey context as a system message
       - Include chat history
       - Include the new user message
    5. Call AIService.call()
    6. Save both user message and assistant response to DB
    7. Return the assistant response
    """

API Endpoints (surveys/views/ai_views.py):

POST /api/surveys/{id}/ai/insights/
  - Generates generic insights for the survey
  - Returns the insights object

GET /api/surveys/{id}/ai/chats/
  - List chat sessions for this survey + user
  - Returns: [{ id, title, created_at, last_message_preview }]

POST /api/surveys/{id}/ai/chats/
  - Create a new chat session
  - Returns the session object

GET /api/surveys/{id}/ai/chats/{session_id}/
  - Get all messages in a chat session

POST /api/surveys/{id}/ai/chats/{session_id}/messages/
  Body: { message: "What is the most common response to Q1?" }
  - Calls AIChatService.chat()
  - Returns: { role: "assistant", content: "..." }

DELETE /api/surveys/{id}/ai/chats/{session_id}/
  - Delete a chat session and all its messages
```

### Step 9.3 — Frontend: AI Insights Button on Analyze Page

```
Update frontend/src/pages/surveys/SurveyAnalyticsPage.jsx:

Add an "AI Insights" button in the analytics top bar
(next to Export and Filter buttons). Use Sparkles icon.

On click:
  - POST to /api/surveys/{id}/ai/insights/
  - Show a loading state with animated skeleton
  - Display results in a collapsible card at the top of the
    analytics page (above the question cards):

    AI Insights Card:
    - Headline in bold
    - Key Findings as a bulleted list with icons
    - Recommendations as a separate bulleted list
    - "Ask a question..." link that opens the chat panel
    - Muted footer: "Generated by AI. Verify important findings."
```

### Step 9.4 — Frontend: Chat Interface

```
Create frontend/src/components/analytics/AIChatPanel.jsx:

This is a slide-over panel (right side, 400px) on the Analyze page.
Triggered by "Ask AI" button or from the Insights card.

Layout:
- Header: "AI Analytics Chat" with close button
- Chat session tabs/dropdown (for switching between sessions)
  + "New Chat" button
- Message area (scrollable):
  - User messages: right-aligned, blue background
  - Assistant messages: left-aligned, gray background,
    supports markdown rendering (use a lightweight markdown
    renderer or simple formatting)
- Input area at bottom:
  - Textarea (auto-grows, max 3 lines)
  - Send button (ArrowUp icon)
  - Keyboard: Enter to send, Shift+Enter for new line

Behavior:
- On first open, load chat sessions from
  GET /api/surveys/{id}/ai/chats/
- If sessions exist, load the most recent one
- If no sessions, auto-create one
- On send: POST message, show typing indicator (...),
  append response when received
- Chat history persists across page navigations and sessions
- When user returns to the Analyze page, the chat panel
  remembers its open/closed state (localStorage)

Create frontend/src/services/aiChat.js:
  - getInsights(surveyId)
  - getChatSessions(surveyId)
  - createChatSession(surveyId)
  - getChatMessages(surveyId, sessionId)
  - sendMessage(surveyId, sessionId, message)
  - deleteChatSession(surveyId, sessionId)
```

---

## Phase Execution Order (Summary)

```
Phase 1  →  User Profile Enhancement
             (0.5 day — model fields, serializers, frontend form)

Phase 2  →  Email Verification
             (1-2 days — verification model, email sending,
              frontend flow, admin toggle)

Phase 3  →  Subscription Plans & Licensing
             (2-3 days — Plan/Subscription models, enforcement,
              API, pricing page, usage banners)

Phase 4  →  Payment Integration — Stripe
             (2-3 days — Stripe Checkout, webhooks, customer
              portal, frontend flow)

Phase 5  →  Payment Integration — Bkash
             (2-3 days — Bkash tokenized API, callback flow,
              renewal management)

Phase 6  →  Frontend Admin Panel
             (3-4 days — admin APIs, dashboard, user management,
              payment history, settings)

Phase 7  →  Survey Access Control
             (0.5 day — require_login setting, public page guard,
              login redirect)

Phase 8  →  AI Question Improver
             (1-2 days — multi-provider AI service, improve
              endpoint, builder UI button)

Phase 9  →  AI Insights Chat
             (2-3 days — chat models, context preparation,
              insights endpoint, chat UI panel)
```

**Total estimated: 14-21 working days**

Dependencies:
- Phase 1 should be done first (profile fields used everywhere)
- Phase 2 can run in parallel with Phase 1
- Phase 3 must come before Phase 4 and 5 (plan models needed)
- Phase 4 and 5 can run in parallel (independent payment providers)
- Phase 6 depends on Phase 3-5 (needs plan/payment data to display)
- Phase 7 is independent, can be done anytime
- Phase 8 should come before Phase 9 (shared AI service)
- Phase 9 depends on Phase 8 (uses AIService)

---

## Key Conventions

```
Follow the same conventions from the original development plan:
- Django 5.x backend with DRF at /backend
- React 19 with JSX (not TypeScript) and shadcn/ui at /frontend
- PostgreSQL database
- All model PKs are UUIDField
- API prefix: /api/
- Use @tanstack/react-query for all data fetching
- Use react-hook-form for forms
- Charts: recharts (primary), @nivo (advanced)
- JWT authentication via SimpleJWT
- Celery + Redis for async tasks
- No SDK dependencies for AI providers — use urllib/requests directly
- SiteSettings singleton for admin-configurable global settings
```
