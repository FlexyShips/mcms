# MCDMS Backend

Phase 0 and Phase 1 scaffold for the Marine Compliance & Documentation Management System backend.

## What Is Included

- Node.js, TypeScript, Express application shell
- Validated environment configuration with Zod
- Pino structured logging
- Global error handling
- Request validation middleware
- Basic public rate limiting
- PostgreSQL Prisma client
- Redis client
- Health endpoint at `/api/v1/health`
- Prisma domain schema for tenants, users, vessels, crew, certificates, documents, renewals, notifications, billing, settings, audit, and integrations
- Seed script for platform defaults, a sample tenant, owner admin, and vessel
- Local Docker Compose services for Postgres with pgvector and Redis
- Tenant resolution middleware
- JWT login, refresh, logout, and current-user endpoints
- Role/permission middleware
- Vessel superintendent scope middleware
- Tenant-scoped Prisma helper

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Then open:

```text
GET http://localhost:3000/api/v1/health
```

## Seed Login Reference

The seed script creates this tenant owner:

```text
Tenant: bluetrack-maritime
Email: owner@bluetrack.example
Password: Password123!
```

Use this seed account to test the Phase 2 authentication endpoints.

## Phase 2 Auth Endpoints

```text
POST /api/v1/auth/login
POST /api/v1/auth/onboard
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Login request:

```json
{
  "tenantSlug": "bluetrack-maritime",
  "email": "owner@bluetrack.example",
  "password": "Password123!"
}
```

Tenant context can also be resolved with one of these headers:

```text
x-tenant-id: <tenant-id>
x-tenant-slug: bluetrack-maritime
x-subdomain: bluetrack-maritime
```

Authenticated requests use:

```text
Authorization: Bearer <accessToken>
```

## Phase 3 Entry Flow

Public waitlist:

```text
POST /api/v1/waitlist
```

Onboarding follows the design in `MCDMS_Backend_System_Design.md` section 8.2:

```json
{
  "token": "<invite-token>",
  "companyName": "Bluetrack Maritime",
  "slug": "bluetrack-maritime",
  "adminEmail": "owner@bluetrack.example",
  "adminPassword": "Password123!",
  "adminFirstName": "Ada",
  "adminLastName": "Okafor",
  "phone": "+2348000000000"
}
```

Subscription endpoints:

```text
GET  /api/v1/subscriptions/plans
GET  /api/v1/subscriptions/current
POST /api/v1/subscriptions/initiate
```

The Super Admin waitlist list/invite service is implemented in `src/modules/waitlist`, but its admin route is intentionally not mounted until Super Admin authentication is implemented in Phase 4.
