# Tenant Authentication and Onboarding Flow

This document describes how a tenant moves from registration to an authenticated workspace and completes its company profile in the current MCDMS backend.

There are two tenant-creation paths:

1. **Self-service signup**: the tenant selects a plan, pays through Paystack, and is created by the payment webhook.
2. **Waitlist invitation onboarding**: an invited waitlist user creates a 14-day trial tenant through `/auth/onboard`.

The self-service signup and payment flow is the primary flow described below.

The normal tenant lifecycle is:

1. Select a plan and tenant slug.
2. Submit signup details.
3. Complete payment, when the selected plan is paid.
4. Wait for the verified payment webhook to activate the tenant.
5. Log in through the tenant subdomain.
6. Complete the company profile.

## 1. Self-service flow at a glance

```text
Tenant
  |
  | 1. Check slug (optional)
  | 2. Submit signup details + planId
  v
POST /api/v1/signup
  |
  | Creates PendingSignup(status=PENDING)
  | Hashes password and generates signup reference
  v
Paystack checkout
  |
  | PendingSignup(status=AWAITING_PAYMENT)
  | Tenant completes payment
  v
POST /api/v1/webhook/paystack
  |
  | Verify Paystack signature and successful charge
  | Create tenant, subscription, owner user and payment record
  v
PendingSignup(status=ACTIVE)
Tenant(status=ACTIVE)
  |
  | Redirect to https://{slug}.${env.FRONTEND_DOMAIN}/login?autologin=true
  v
POST /api/v1/auth/login
  |
  | Issue access and refresh tokens
  v
Authenticated tenant session
  |
  | 6. Read and complete company profile
  v
GET/PATCH /api/v1/tenant/profile
  |
  v
Tenant workspace ready for company data
```

For a zero-priced plan, payment is skipped. The tenant is created immediately as a 14-day trial and the signup is marked `ACTIVE`.

## 2. Step 1: Select a plan and validate the tenant slug

The frontend may load available plans with:

```http
GET /api/v1/plan/plans
```

The tenant slug can be checked before signup:

```http
GET /api/v1/signup/slug/{slug}
```

The slug must:

- Be 2–80 characters long.
- Contain lowercase letters, numbers, and hyphens.
- Not be a reserved subdomain such as `www`, `api`, `admin`, `app`, `mail`, `mcdms`, `staging`, or `localhost`.
- Not already exist in `Tenant` or `PendingSignup`.

The slug becomes the tenant's subdomain: `https://{slug}.${env.FRONTEND_DOMAIN}`.

## 3. Step 2: Submit signup details

The frontend submits:

```http
POST /api/v1/signup
Content-Type: application/json
```

```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "a-password-with-at-least-8-chars",
  "companyName": "Example Marine Ltd",
  "slug": "example-marine",
  "planId": "plan-id"
}
```

The service then:

1. Normalizes the email to lowercase and trims whitespace.
2. Rejects an email already belonging to a user.
3. Rechecks slug availability.
4. Loads the selected plan.
5. Hashes the password with bcrypt (12 rounds).
6. Generates a unique reference in the form `signup_<random-value>`.
7. Creates a `PendingSignup` record with an expiry time 24 hours in the future.

At this stage no tenant or user exists for a paid plan. The credentials are held in `PendingSignup.passwordHash` until payment succeeds.

### Paid plan response

For a paid plan, the API initializes Paystack checkout and returns:

```json
{
  "reference": "signup_...",
  "checkoutUrl": "https://checkout.paystack.com/...",
  "provider": "paystack",
  "message": "Please complete payment to activate your account"
}
```

The `PendingSignup` status changes from `PENDING` to `AWAITING_PAYMENT`. The frontend should redirect the tenant to `checkoutUrl`.

The checkout metadata includes the signup reference, plan name, billing cycle, company name, slug, and signup type. The Paystack callback URL points to:

```text
{APP_URL}/api/v1/signup/callback
```

### Zero-priced plan response

If the selected plan has `amountKobo <= 0`, no Paystack checkout is created. The service immediately creates:

- A `Tenant` with status `TRIAL`.
- A `TenantSettings` record with AI and integrations disabled.
- An active `Subscription` whose period ends 14 days later.
- An owner `User` with role `ADMIN` and `isOwner = true`.

The `PendingSignup` is marked `ACTIVE`, and a welcome email is queued. The response contains the signup reference without a checkout URL.

## 4. Step 3: Complete payment

Paystack sends the payment result to:

```http
POST /api/v1/webhook/paystack
```

The webhook handler:

1. Requires the `x-paystack-signature` header.
2. Recomputes the HMAC-SHA512 signature using `PAYSTACK_SECRET_KEY`.
3. Accepts only a `charge.success` event whose payment status is `success`.
4. Reads `data.metadata.signupReference`.
5. Looks up the matching `PendingSignup`.

The browser callback is not the source of truth for activation. The callback only reads signup status and redirects the browser; activation is performed from the verified Paystack webhook.

## 5. Step 4: Create and activate the tenant

For a paid signup in `AWAITING_PAYMENT`, `completeOnboarding` runs in a database transaction. It creates:

### Tenant

- `name`: company name from the pending signup.
- `slug`: requested tenant slug.
- `email`: normalized signup email.
- `status`: `ACTIVE`.
- `TenantSettings`: created with AI and integrations enabled for plans other than `STARTER`.

### Subscription

- Linked to the selected plan.
- Status: `ACTIVE`.
- Billing cycle: selected plan's billing cycle.
- Amount and currency: plan amount and `NGN`.
- Current period: calculated from the successful payment time.
- Payment reference: Paystack transaction reference.

### Owner user

- Email and password hash copied from `PendingSignup`.
- First name and last name split from `fullName`.
- Role: `ADMIN`.
- `isOwner`: `true`.

### Payment

A successful `Payment` record is saved with:

- The Paystack reference.
- Amount and currency.
- `SUCCESS` status.
- Provider `paystack`.
- Paystack subscription and email tokens when returned by the gateway.

Finally, the pending signup is updated with the new `tenantId` and status `ACTIVE`, and a welcome email is queued with the tenant login URL.

## 6. Step 5: Return the tenant to login

The callback endpoint is:

```http
GET /api/v1/signup/callback?reference={signup-reference}
```

Redirect behavior:

| Signup status                | Redirect                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `ACTIVE`                     | `https://{slug}.${env.FRONTEND_DOMAIN}/login?autologin=true` |
| `AWAITING_PAYMENT`           | `{APP_URL}/signup/pending?slug={slug}`                       |
| Any other valid status       | `{APP_URL}/signup?slug={slug}`                               |
| Missing or invalid reference | `{APP_URL}/signup`                                           |

The frontend can also poll:

```http
GET /api/v1/signup/status/{reference}
```

The status endpoint returns the signup status, slug, and company name. A non-active signup expires after 24 hours; an expired lookup changes the status to `EXPIRED` and returns an expiration error.

## 7. Step 6: Authenticate the tenant owner

The tenant owner logs in from the tenant subdomain:

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "jane@example.com",
  "password": "a-password-with-at-least-8-chars"
}
```

Tenant context is resolved from one of the following, in this order of preference:

- `x-tenant-id` or `x-tenant-slug` headers.
- Tenant cookies.
- The request host, for example `example-marine.${env.FRONTEND_DOMAIN}`.
- `slug` or `tenantSlug` in the request body.

The login service requires a tenant context, verifies the user and password, and permits login only when the tenant status is `TRIAL` or `ACTIVE`. On success it issues:

- A short-lived access token.
- A refresh token stored as a hash in `RefreshToken`.

The controller also sets `accessToken`, `refreshToken`, `tenantId`, and `tenantSlug` cookies where applicable.

Subsequent authenticated requests carry the access token. Tenant-aware middleware resolves the subdomain or tenant headers, and authorization uses the tenant ID from the authenticated context to keep tenant data isolated.

## 8. Complete the company profile after authentication

Company profile completion happens after the tenant is activated and the owner has authenticated. The profile is tenant-scoped, so the request must include the tenant context established during login (normally the tenant subdomain and cookies).

The owner or another tenant admin can read and update the company profile:

```http
GET /api/v1/tenant/profile
PATCH /api/v1/tenant/profile
```

The profile can include:

```json
{
  "name": "Example Marine Ltd",
  "email": "operations@example.com",
  "phone": "+234...",
  "companyLogo": "https://cdn.example.com/logo.png",
  "companyAddress": "Lagos, Nigeria",
  "companyWebsite": "https://example.com",
  "timezone": "Africa/Lagos",
  "dateFormat": "DD/MM/YYYY",
  "language": "en"
}
```

`GET` requires authentication. `PATCH` requires an authenticated tenant admin. The tenant slug is intentionally not editable through this endpoint because it is used for subdomain routing. Changes are recorded in the tenant audit log.

All update fields are optional, so the frontend can save the profile in more than one step. The current API does not enforce a required-field checklist or persist a separate `profileCompleted` flag; the frontend should decide when to display the onboarding-complete state based on the fields it requires.

## 9. Failure and retry behavior

### Signup failures

- Existing email: `409 EMAIL_EXISTS`.
- Existing or reserved slug: `409 SLUG_TAKEN`.
- Invalid plan: `400 INVALID_SUBSCRIPTION_PLAN`.
- Invalid input: validation error from the signup schema.

### Payment failures or abandoned checkout

The pending signup remains `AWAITING_PAYMENT` until it expires. The tenant is not created until a successful, signature-verified Paystack charge is received.

### Webhook retries

`completeOnboarding` is designed to be idempotent. If the signup is already `ACTIVE`, it returns the existing tenant and owner instead of creating them again. Payment renewal processing also checks the payment reference before applying a period extension twice.

### Expiration

Pending signups expire 24 hours after creation unless they become `ACTIVE`. The status endpoint performs the expiry transition when it sees an expired pending signup.

## 10. Waitlist invitation onboarding path

This is a separate path from paid self-service signup.

An invited waitlist user receives a one-time Redis token. The frontend submits:

```http
POST /api/v1/auth/onboard
```

The request must contain:

```json
{
  "token": "one-time-invite-token",
  "companyName": "Example Marine Ltd",
  "slug": "example-marine",
  "adminEmail": "jane@example.com",
  "adminPassword": "a-password-with-at-least-8-chars",
  "adminFirstName": "Jane",
  "adminLastName": "Doe",
  "phone": "+234..."
}
```

The service validates that:

- The token exists and has not expired.
- The admin email matches the invited waitlist email.
- The tenant slug and email are not already in use.

It then creates a `TRIAL` tenant, starter subscription, tenant settings, and owner admin user in one transaction; marks the waitlist entry as `CONVERTED`; deletes the invite token; and returns an access/refresh token pair.

This path does not use the self-service Paystack signup reference or the paid-signup webhook flow.

## 11. Operational notes

- Configure `PAYSTACK_SECRET_KEY` and `APP_URL` before enabling paid signup.
- Configure Paystack to send webhooks to `/api/v1/webhook/paystack`.
- Treat the webhook as the authoritative payment signal; do not activate a tenant solely because the browser returned from checkout.
- Keep the signup reference available to the frontend so it can poll status and recover from a closed or interrupted checkout window.
- Renewal payments use the existing tenant subscription and extend the period; they do not create another tenant or owner user.
