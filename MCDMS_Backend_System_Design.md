# MCDMS — Backend System Design
## Marine Compliance & Documentation Management System
**Stack:** Node.js · TypeScript · Express.js · PostgreSQL · Redis · Prisma · BullMQ  
**Version:** 5.0 — Final Consolidated Architecture  
**Date:** June 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Domain Model & Database Schema](#3-domain-model--database-schema)
4. [Multi-Tenancy Strategy](#4-multi-tenancy-strategy)
5. [Department Roles, Permissions & Notification Routing](#5-department-roles-permissions--notification-routing)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Subdomain-Based Tenant Routing](#7-subdomain-based-tenant-routing)
8. [Module-by-Module API Design](#8-module-by-module-api-design)
9. [AI Integration Layer](#9-ai-integration-layer)
10. [Background Job Architecture (BullMQ)](#10-background-job-architecture-bullmq)
11. [Redis Usage Map](#11-redis-usage-map)
12. [File Storage Architecture](#12-file-storage-architecture)
13. [Notification Service](#13-notification-service)
14. [Billing & Subscription Model](#14-billing--subscription-model)
15. [Admin Architecture — Super Admin vs Tenant Admin](#15-admin-architecture--super-admin-vs-tenant-admin)
16. [Super Admin Control Plane & Feature Gating](#16-super-admin-control-plane--feature-gating)
17. [Platform Settings & Tenant Settings](#17-platform-settings--tenant-settings)
18. [Third-Party HR Integration Layer](#18-third-party-hr-integration-layer)
19. [Security Architecture](#19-security-architecture)
20. [Observability & Logging](#20-observability--logging)
21. [Project Folder Structure](#21-project-folder-structure)
22. [Environment Configuration](#22-environment-configuration)
23. [Trade-off Analysis](#23-trade-off-analysis)
24. [Blue-Green Deployment Strategy](#24-blue-green-deployment-strategy)
25. [CI/CD Pipeline — Staging, Production & Local Commit Checks](#25-cicd-pipeline--staging-production--local-commit-checks)

---

## 1. System Overview

MCDMS is a **multi-tenant SaaS platform** serving Nigerian maritime companies. It digitises compliance tracking, vessel certification, crew documentation, and renewal workflows — replacing error-prone Excel-based processes.

### Core Characteristics

| Property | Decision |
|---|---|
| Architecture | Modular Monolith (MVP), structured for future microservice extraction |
| Multi-tenancy | Row-level isolation via `tenantId` on every table |
| Auth | JWT (access) + Refresh Token rotation |
| Background Jobs | BullMQ over Redis for notifications, reports, imports |
| AI | LLM integration as a pluggable service layer |
| File Storage | S3-compatible object store (AWS S3 / Cloudflare R2) |
| API Style | REST with versioning (`/api/v1/`) |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│          Browser (React)  ·  Mobile (PWA)  ·  3rd Party APIs       │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────────┐
│                        API GATEWAY / NGINX                          │
│           Rate Limiting · TLS Termination · Load Balancing          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    EXPRESS.JS APPLICATION SERVER                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Auth Layer  │  │ Route Layer  │  │   Middleware Pipeline    │  │
│  │  JWT + RBAC  │  │ /api/v1/...  │  │ Tenant·Module·Validate   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      SERVICE LAYER                            │  │
│  │  Fleet · Vessel · Crew · Docs · Compliance · Notification     │  │
│  │  Subscription · Waitlist · AI · Reporting · Migration         │  │
│  │  Settings · Integrations · Admin                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────┬───────────┬──────────────┬──────────────────┬───────────────┘
       │           │              │                  │
┌──────▼───┐ ┌────▼─────┐ ┌──────▼──────┐ ┌────────▼────────┐
│PostgreSQL│ │  Redis   │ │   BullMQ    │ │  Object Store   │
│(Prisma)  │ │ Cache+   │ │  Job Queues │ │  S3 / R2        │
│+pgvector │ │ Sessions │ │             │ │                 │
└──────────┘ └──────────┘ └──────┬──────┘ └─────────────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │       WORKERS              │
                    │  Notification · Import ·   │
                    │  Report · AI · Webhook ·   │
                    │  Cleanup                   │
                    └────────────────────────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │    EXTERNAL SERVICES        │
                    │  Email(SES) · SMS(Termii)   │
                    │  WhatsApp · AI Provider     │
                    │  Paystack / Flutterwave     │
                    └────────────────────────────┘
```

---

## 3. Domain Model & Database Schema

### 3.1 Tenant & Subscription

```prisma
model Tenant {
  id           String       @id @default(cuid())
  name         String
  slug         String       @unique   // e.g. "bluetrack-maritime"
  email        String       @unique   // primary contact email
  phone        String?
  status       TenantStatus @default(TRIAL)
  trialEndsAt  DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  subscription Subscription?
  settings     TenantSettings?
  users        User[]
  vessels      Vessel[]
  crewMembers  CrewMember[]
  certificates Certificate[]
  documents    Document[]
  renewalItems RenewalItem[]
  apiKeys      ApiKey[]
  webhooks     WebhookEndpoint[]
}

enum TenantStatus {
  WAITLIST
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

model Subscription {
  id                 String             @id @default(cuid())
  tenantId           String             @unique
  tenant             Tenant             @relation(fields: [tenantId], references: [id])
  plan               SubscriptionPlan
  status             SubscriptionStatus @default(PENDING)
  billingCycle       BillingCycle       @default(MONTHLY)
  amount             Decimal            @db.Decimal(10,2)
  currency           String             @default("NGN")
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  paymentReference   String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  payments           Payment[]
}

enum SubscriptionPlan {
  STARTER    // Up to 5 vessels
  GROWTH     // Up to 20 vessels — includes AI + Integrations
  ENTERPRISE // Unlimited vessels — includes all features
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  PAST_DUE
  CANCELLED
}

enum BillingCycle {
  MONTHLY
  ANNUALLY
}

model Payment {
  id             String        @id @default(cuid())
  subscriptionId String
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id])
  amount         Decimal       @db.Decimal(10,2)
  currency       String
  reference      String        @unique
  provider       String        // "paystack" | "flutterwave"
  status         PaymentStatus
  paidAt         DateTime?
  metadata       Json?
  createdAt      DateTime      @default(now())
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

model Waitlist {
  id          String         @id @default(cuid())
  email       String         @unique
  companyName String
  phone       String?
  fleetSize   Int?
  notes       String?
  referral    String?
  status      WaitlistStatus @default(PENDING)
  invitedAt   DateTime?
  createdAt   DateTime       @default(now())
}

enum WaitlistStatus {
  PENDING
  INVITED
  CONVERTED
  REJECTED
}
```

---

### 3.2 Users & Roles

```prisma
model User {
  id           String    @id @default(cuid())
  tenantId     String
  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  email        String
  passwordHash String
  firstName    String
  lastName     String
  role         UserRole
  isOwner      Boolean   @default(false)  // Founding Admin — immune to demotion
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  refreshTokens        RefreshToken[]
  auditLogs            AuditLog[]
  assignedVessels      Vessel[]       @relation("VesselSuperintendent")

  @@unique([tenantId, email])
  @@index([tenantId])
}

enum UserRole {
  ADMIN                 // Full system access + billing + user management
  FLEET_MANAGER         // Full operational access — no billing or user management
  MARINE_SUPERINTENDENT // Vessel assets + vessel crew visibility (own vessels only)
  HR_MANAGER            // Crew records + crew documents
  CREW_MEMBER           // Own profile only (optional login)
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  token     String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?
}

model SuperAdmin {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  firstName    String
  lastName     String
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())

  auditLogs    SuperAdminAuditLog[]
}
```

---

### 3.3 Vessels

```prisma
model Vessel {
  id                       String       @id @default(cuid())
  tenantId                 String
  tenant                   Tenant       @relation(fields: [tenantId], references: [id])
  name                     String
  imoNumber                String?
  vesselType               String       // Tanker, Cargo, Tugboat, etc.
  flagState                String
  grossTonnage             Decimal?     @db.Decimal(10,2)
  yearBuilt                Int?
  status                   VesselStatus @default(ACTIVE)

  // Superintendent assignment — only this user manages this vessel's compliance
  assignedSuperintendentId String?
  assignedSuperintendent   User?        @relation("VesselSuperintendent",
                                          fields: [assignedSuperintendentId],
                                          references: [id])

  createdAt                DateTime     @default(now())
  updatedAt                DateTime     @updatedAt

  certificates             Certificate[]
  crewAssignments          VesselCrewAssignment[]
  renewalItems             RenewalItem[]

  @@index([tenantId])
  @@index([assignedSuperintendentId])
}

enum VesselStatus {
  ACTIVE
  INACTIVE
  UNDER_REPAIR
  DECOMMISSIONED
}
```

---

### 3.4 Certificates & Documents

```prisma
// Unified model for both vessel certificates and crew documents
model Certificate {
  id               String       @id @default(cuid())
  tenantId         String
  vesselId         String?      // null for crew docs
  crewMemberId     String?      // null for vessel certs
  tenant           Tenant       @relation(fields: [tenantId], references: [id])
  vessel           Vessel?      @relation(fields: [vesselId], references: [id])
  crewMember       CrewMember?  @relation(fields: [crewMemberId], references: [id])

  name             String
  category         CertCategory
  issuingAuthority String
  issuedAt         DateTime
  expiresAt        DateTime
  fileUrl          String?
  fileKey          String?      // S3 object key
  status           CertStatus   @default(VALID)
  notes            String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  renewalItem      RenewalItem?

  @@index([tenantId])
  @@index([expiresAt])  // critical for expiry queries
}

enum CertCategory {
  // Vessel categories
  STATUTORY
  CLASSIFICATION
  OPERATIONAL
  // Crew categories
  COMPETENCY
  MEDICAL
  TRAVEL_DOCUMENT
}

enum CertStatus {
  VALID
  EXPIRING_SOON
  EXPIRED
  UNDER_RENEWAL
  SUSPENDED
}

model DocumentEmbedding {
  id         String   @id @default(cuid())
  tenantId   String
  documentId String
  content    String   @db.Text
  embedding  Unsupported("vector(1536)")?  // pgvector for RAG
  createdAt  DateTime @default(now())

  @@index([tenantId])
}
```

---

### 3.5 Crew

```prisma
model CrewMember {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  firstName      String
  lastName       String
  rank           String
  email          String?
  phone          String?
  nationality    String?
  passportNumber String?
  dateOfBirth    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  certificates   Certificate[]
  assignments    VesselCrewAssignment[]

  @@index([tenantId])
}

model VesselCrewAssignment {
  id           String     @id @default(cuid())
  vesselId     String
  crewMemberId String
  vessel       Vessel     @relation(fields: [vesselId], references: [id])
  crewMember   CrewMember @relation(fields: [crewMemberId], references: [id])
  startDate    DateTime
  endDate      DateTime?
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())

  @@unique([vesselId, crewMemberId, startDate])
}
```

---

### 3.6 Renewal Workflow

```prisma
model RenewalItem {
  id            String         @id @default(cuid())
  tenantId      String
  tenant        Tenant         @relation(fields: [tenantId], references: [id])
  certificateId String         @unique
  certificate   Certificate    @relation(fields: [certificateId], references: [id])
  vesselId      String?
  vessel        Vessel?        @relation(fields: [vesselId], references: [id])
  stage         RenewalStage   @default(EXPIRY_IDENTIFIED)
  assignedTo    String?        // userId
  dueDate       DateTime
  notes         String?
  history       RenewalHistory[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([tenantId])
}

model RenewalHistory {
  id            String       @id @default(cuid())
  renewalItemId String
  renewalItem   RenewalItem  @relation(fields: [renewalItemId], references: [id])
  fromStage     RenewalStage?
  toStage       RenewalStage
  changedBy     String       // userId
  comment       String?
  createdAt     DateTime     @default(now())
}

enum RenewalStage {
  EXPIRY_IDENTIFIED
  DOCUMENTS_REQUESTED
  SUBMITTED_TO_AUTHORITY
  UNDER_SURVEY
  APPROVED
  CLOSED
}
```

---

### 3.7 Notifications & Audit

```prisma
model NotificationLog {
  id            String   @id @default(cuid())
  tenantId      String
  certificateId String?
  channel       String   // email | sms | whatsapp
  recipient     String
  subject       String?
  status        String   // sent | failed
  sentAt        DateTime?
  errorMsg      String?
  createdAt     DateTime @default(now())
}

model AiInteraction {
  id         String   @id @default(cuid())
  tenantId   String
  userId     String
  feature    String   // compliance_summary | doc_extraction | renewal_suggestion
  prompt     String   @db.Text
  response   String   @db.Text
  tokensUsed Int?
  latencyMs  Int?
  createdAt  DateTime @default(now())

  @@index([tenantId])
}

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String   // CREATE_CERTIFICATE | DELETE_VESSEL | etc.
  entity    String   // "Certificate" | "Vessel" | etc.
  entityId  String
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([createdAt])
}

model SuperAdminAuditLog {
  id           String     @id @default(cuid())
  superAdminId String
  superAdmin   SuperAdmin @relation(fields: [superAdminId], references: [id])
  action       String
  tenantId     String?
  before       Json?
  after        Json?
  note         String?
  createdAt    DateTime   @default(now())
}
```

---

### 3.8 Integrations

```prisma
model ApiKey {
  id         String    @id @default(cuid())
  tenantId   String
  tenant     Tenant    @relation(fields: [tenantId], references: [id])
  name       String
  keyHash    String    @unique  // bcrypt hashed — never stored plain
  keyPrefix  String             // First 8 chars shown in UI
  scopes     String[]           // ["crew:read", "crew:write", "vessels:read"]
  lastUsedAt DateTime?
  expiresAt  DateTime?
  isActive   Boolean   @default(true)
  createdBy  String
  createdAt  DateTime  @default(now())
}

model WebhookEndpoint {
  id         String            @id @default(cuid())
  tenantId   String
  tenant     Tenant            @relation(fields: [tenantId], references: [id])
  name       String
  url        String
  secret     String
  events     String[]
  isActive   Boolean           @default(true)
  createdAt  DateTime          @default(now())
  deliveries WebhookDelivery[]
}

model WebhookDelivery {
  id           String          @id @default(cuid())
  endpointId   String
  endpoint     WebhookEndpoint @relation(fields: [endpointId], references: [id])
  event        String
  payload      Json
  statusCode   Int?
  responseBody String?
  attemptCount Int             @default(0)
  deliveredAt  DateTime?
  nextRetryAt  DateTime?
  status       DeliveryStatus  @default(PENDING)
  createdAt    DateTime        @default(now())
}

enum DeliveryStatus {
  PENDING
  DELIVERED
  FAILED
  EXHAUSTED
}
```

---

## 4. Multi-Tenancy Strategy

### Approach: Shared Schema + Row-Level Isolation

Every table carries a `tenantId` column. All service calls receive a `tenantId` from the authenticated JWT and apply it as a mandatory `WHERE` clause via a **Prisma client extension**.

```typescript
// src/lib/prisma.ts
const globalPrisma = new PrismaClient();

export function getTenantClient(tenantId: string) {
  return globalPrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model }) {
          const tenantIsolatedModels = [
            'Vessel', 'Certificate', 'CrewMember', 'RenewalItem',
            'Document', 'NotificationLog', 'AuditLog', 'AiInteraction',
            'ApiKey', 'WebhookEndpoint',
          ];
          if (tenantIsolatedModels.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
```

**Trade-off:** Shared schema is operationally simpler for MVP but requires the Prisma extension as a hard safeguard. For Enterprise clients requiring hard isolation, a "dedicated database" tier can be added without changing the service layer interface.

---

## 5. Department Roles, Permissions & Notification Routing

### 5.1 Roles as Departments

In MCDMS, roles represent **organisational departments**. Each department has a clearly scoped area of responsibility.

| Department | Primary Responsibility |
|---|---|
| **Admin** | Full system ownership — billing, users, all modules |
| **Fleet Manager** | Full operational oversight — identical access to Admin except billing/users |
| **Marine Superintendent** | Manages vessel assets on vessels assigned to them |
| **HR Manager** | Manages crew member records and crew compliance |
| **Crew Member** | Views own profile and personal document status only (optional login) |

**Admin and Fleet Manager are functionally equivalent in operational access.** The distinction is organisational: Admin owns the account (billing, user management, settings) while Fleet Manager is a senior operations role.

---

### 5.2 Vessel Superintendent Assignment

A vessel is assigned to a specific Marine Superintendent. Only the Admin or Fleet Manager can assign or reassign vessels. The superintendent then owns all compliance responsibility for that vessel.

```typescript
async assignSuperintendent(tenantId: string, vesselId: string, superintendentId: string, requestingUser: User) {
  if (!['ADMIN', 'FLEET_MANAGER'].includes(requestingUser.role)) {
    throw new AppError('Only Admin or Fleet Manager can assign a superintendent.', 403);
  }

  const superintendent = await prisma.user.findFirst({
    where: { id: superintendentId, tenantId, role: 'MARINE_SUPERINTENDENT', isActive: true },
  });

  if (!superintendent) throw new AppError('User is not an active Marine Superintendent.', 404);

  await prisma.vessel.update({
    where: { id: vesselId, tenantId },
    data: { assignedSuperintendentId: superintendentId },
  });

  // Invalidate notification routing cache
  await redis.del(`vessel:notifications:${vesselId}`);
}
```

---

### 5.3 "Own Vessels" Scoping for Superintendent

```typescript
async listVessels(tenantId: string, requestingUser: User) {
  const db = getTenantClient(tenantId);

  if (['ADMIN', 'FLEET_MANAGER'].includes(requestingUser.role)) {
    return db.vessel.findMany({ orderBy: { name: 'asc' } });
  }

  if (requestingUser.role === 'MARINE_SUPERINTENDENT') {
    return db.vessel.findMany({
      where: { assignedSuperintendentId: requestingUser.id },
      orderBy: { name: 'asc' },
    });
  }

  throw new AppError('Insufficient permissions to list vessels.', 403);
}

// Called at the start of every vessel-specific operation
async getVesselOrThrow(tenantId: string, vesselId: string, requestingUser: User) {
  const db = getTenantClient(tenantId);
  const vessel = await db.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) throw new AppError('Vessel not found.', 404);

  if (
    requestingUser.role === 'MARINE_SUPERINTENDENT' &&
    vessel.assignedSuperintendentId !== requestingUser.id
  ) {
    throw new AppError('You are not assigned to this vessel.', 403);
  }

  return vessel;
}
```

---

### 5.4 Full Permission Matrix

#### Fleet & Vessel Module

| Action | Admin | Fleet Mgr | Marine Supt | HR Manager | Crew Member |
|---|:---:|:---:|:---:|:---:|:---:|
| View fleet dashboard | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| Create vessel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit vessel details | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| Delete vessel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign superintendent to vessel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add / edit vessel certificate | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| Delete vessel certificate | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage renewal workflows | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| View vessel crew assignments | ✅ | ✅ | ✅ Own vessels | ✅ | ❌ |
| Upload vessel documents | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| Generate vessel reports | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |
| Excel migration (vessel data) | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Crew Module

| Action | Admin | Fleet Mgr | Marine Supt | HR Manager | Crew Member |
|---|:---:|:---:|:---:|:---:|:---:|
| Create crew member | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit crew member profile | ✅ | ✅ | ❌ | ✅ | Own contact only |
| Delete crew member | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all crew members | ✅ | ✅ | ✅ Own vessels only | ✅ | ❌ |
| Add / edit crew document | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete crew document | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign crew to vessel | ✅ | ✅ | ❌ | ✅ | ❌ |
| Activate crew member login | ✅ | ✅ | ❌ | ✅ | ❌ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate crew reports | ✅ | ✅ | ✅ Own vessel crew | ✅ | ❌ |
| Excel migration (crew data) | ✅ | ✅ | ❌ | ✅ | ❌ |

#### System & Admin Module

| Action | Admin | Fleet Mgr | Marine Supt | HR Manager | Crew Member |
|---|:---:|:---:|:---:|:---:|:---:|
| Invite / manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage subscription & billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure notification settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage API keys & webhooks | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure tenant settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI features | ✅ | ✅ | ✅ Own vessels | ❌ | ❌ |

---

### 5.5 Notification Routing by Department

#### Vessel Certificate Notifications

| Recipient | Why |
|---|---|
| **Admin** | Full system owner — always informed |
| **Fleet Manager** | Full operational oversight — always informed |
| **Assigned Marine Superintendent** | Directly responsible for that vessel |

```typescript
async getVesselCertNotificationRecipients(tenantId: string, vesselId: string): Promise<User[]> {
  const vessel = await prisma.vessel.findUnique({
    where: { id: vesselId },
    select: { assignedSuperintendentId: true },
  });

  const alwaysNotified = await prisma.user.findMany({
    where: { tenantId, role: { in: ['ADMIN', 'FLEET_MANAGER'] }, isActive: true },
  });

  const recipients = [...alwaysNotified];

  if (vessel?.assignedSuperintendentId) {
    const superintendent = await prisma.user.findUnique({
      where: { id: vessel.assignedSuperintendentId },
    });
    if (superintendent && !recipients.some((r) => r.id === superintendent.id)) {
      recipients.push(superintendent);
    }
  }

  return recipients;
}
```

#### Crew Document Notifications

| Recipient | Why |
|---|---|
| **Admin** | Full system owner — always informed |
| **HR Manager** | Primary custodian of crew records — always informed |
| **Assigned Marine Superintendent** | Responsible for the vessel the crew member is currently on |

```typescript
async getCrewDocNotificationRecipients(tenantId: string, crewMemberId: string): Promise<User[]> {
  const assignment = await prisma.vesselCrewAssignment.findFirst({
    where: { crewMemberId, isActive: true },
    include: { vessel: { select: { assignedSuperintendentId: true } } },
  });

  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
  });

  const hrManagers = await prisma.user.findMany({
    where: { tenantId, role: 'HR_MANAGER', isActive: true },
  });

  const recipients = [...admins, ...hrManagers];

  if (assignment?.vessel?.assignedSuperintendentId) {
    const superintendent = await prisma.user.findUnique({
      where: { id: assignment.vessel.assignedSuperintendentId },
    });
    if (superintendent && !recipients.some((r) => r.id === superintendent.id)) {
      recipients.push(superintendent);
    }
  }

  return recipients;
}
```

#### Notification Routing Summary

| Event Type | Admin | Fleet Mgr | Marine Supt | HR Manager | Crew Member |
|---|:---:|:---:|:---:|:---:|:---:|
| Vessel cert expiring / expired | ✅ Always | ✅ Always | ✅ Assigned vessel only | ❌ | ❌ |
| Crew doc expiring / expired | ✅ Always | ❌ | ✅ If crew on their vessel | ✅ Always | ✅ Own doc only |
| Renewal stage changed | ✅ Always | ✅ Always | ✅ Assigned vessel only | ❌ | ❌ |
| Subscription payment due | ✅ Always | ❌ | ❌ | ❌ | ❌ |

---

### 5.6 Crew Member Login — Optional by Design

Crew Members are data records by default. The HR Manager activates their account when portal access is needed.

**What a Crew Member sees:**
- Their personal profile (contact details editable; rank read-only)
- Their own documents and expiry statuses
- Their current vessel assignment — name and contract dates only (read-only)
- `overallComplianceStatus`: `FULLY_COMPLIANT` / `ATTENTION_REQUIRED` / `NON_COMPLIANT`

**What a Crew Member does NOT see:**
- Vessel certificates (ISM, MARPOL, Class certs)
- Other crew members' records
- Fleet dashboard or any company-wide data

**Crew Member API surface (all other routes return 403):**
```
GET    /api/v1/crew/me
PATCH  /api/v1/crew/me
GET    /api/v1/crew/me/documents
GET    /api/v1/crew/me/documents/:id
GET    /api/v1/crew/me/assignments
```

**Invite flow:**
```
HR Manager → "Activate Account" on crew member profile
      │
      ├── One-time invite token generated (Redis, TTL 48hrs)
      ├── Email sent: https://{slug}.mcdms.com/accept-invite?token=xxx
      │
Crew Member sets password → isActive = true
      └── Logs in → personal compliance dashboard only
```

---

## 6. Authentication & Authorization

### 6.1 Token Strategy

| Token | TTL | Storage |
|---|---|---|
| Access JWT | 15 minutes | Memory (client) |
| Refresh Token | 7 days | HttpOnly cookie + DB |

### 6.2 JWT Claims

**Tenant user:**
```json
{ "sub": "user_abc123", "tenantId": "tenant_xyz", "role": "MARINE_SUPERINTENDENT", "scope": "tenant" }
```

**Super Admin:**
```json
{ "sub": "superadmin_abc123", "role": "SUPER_ADMIN", "scope": "platform" }
```

### 6.3 Middleware Pipeline

```typescript
// Auth middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  const payload = verifyAccessToken(token);

  // Cross-check: JWT tenant must match subdomain tenant
  if (req.tenant && payload.tenantId !== req.tenant.id) {
    return res.status(403).json({ message: 'You do not belong to this organisation.' });
  }

  req.user = payload;
  req.tenantId = payload.tenantId;
  next();
};

// Role guard
export const authorize = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };

// Module entitlement guard
export const requireModule = (module: keyof TenantModules) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = `tenant:settings:${req.tenantId}`;
    let settings = await redis.get(cacheKey);

    if (!settings) {
      const dbSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: req.tenantId },
      });
      settings = JSON.stringify(dbSettings);
      await redis.set(cacheKey, settings, 'EX', 300);
    }

    if (!JSON.parse(settings as string)[module]) {
      return res.status(403).json({
        message: 'Your current plan does not include this module. Please upgrade or contact support.',
        module,
      });
    }
    next();
  };

// Platform guard
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.scope !== 'platform') {
    return res.status(403).json({ message: 'Platform access only.' });
  }
  next();
};

// Tenant Admin guard
export const requireTenantAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.role !== 'ADMIN' || req.user.scope !== 'tenant') {
    return res.status(403).json({ message: 'Company admin access only.' });
  }
  next();
};
```

**Middleware order on every protected route:**
```
resolveTenant → authenticate → authorize(roles) → requireModule(module) → controller
```

---

## 7. Subdomain-Based Tenant Routing

### 7.1 How It Works

Every registered company gets a unique slug that becomes their subdomain:
```
bluetrack-maritime.mcdms.com
oceanfleet.mcdms.com
```

All subdomains resolve to the same Express server. A middleware reads the subdomain, resolves the tenant, and scopes the entire request.

### 7.2 Slug Generation

```typescript
// src/utils/slug.ts
export function generateSlug(companyName: string): string {
  return slugify(companyName, { lower: true, strict: true, trim: true }).slice(0, 50);
}

// During onboarding — ensure uniqueness
async function resolveUniqueSlug(base: string): Promise<string> {
  const existing = await prisma.tenant.findUnique({ where: { slug: base } });
  return existing ? `${base}-${nanoid(4)}` : base;
}
```

Slugs are **locked after registration** — changing a subdomain breaks bookmarks and is operationally disruptive.

### 7.3 DNS, SSL & Nginx

**DNS (Cloudflare — configure once):**
```
Type: A    Name: *    Value: <server-IP>    Proxy: ✅
Type: A    Name: @    Value: <server-IP>    Proxy: ✅
```

**SSL (Certbot wildcard — configure once, auto-renews):**
```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d "mcdms.com" -d "*.mcdms.com"
```

**Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name ~^(?<subdomain>[a-z0-9-]+)\.mcdms\.com$;

    ssl_certificate     /etc/letsencrypt/live/mcdms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcdms.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host         $host;
        proxy_set_header   X-Subdomain  $subdomain;
        proxy_set_header   X-Real-IP    $remote_addr;
    }
}
```

### 7.4 Tenant Resolution Middleware

```typescript
// src/middlewares/tenant.middleware.ts
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const subdomain = req.headers['x-subdomain'] as string;
  if (!subdomain || subdomain === 'www' || subdomain === 'app') return next();

  const cacheKey = `tenant:slug:${subdomain}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    req.tenant = JSON.parse(cached);
    return next();
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: subdomain },
    select: { id: true, name: true, slug: true, status: true,
              subscription: { select: { status: true, plan: true } } },
  });

  if (!tenant) return res.status(404).json({ message: `No company found at ${subdomain}.mcdms.com` });

  if (['SUSPENDED', 'CANCELLED'].includes(tenant.status)) {
    return res.status(403).json({ message: 'This account has been suspended. Please contact support.' });
  }

  await redis.set(cacheKey, JSON.stringify(tenant), 'EX', 600);
  req.tenant = tenant;
  next();
}
```

### 7.5 Infrastructure Summary

| Layer | Configuration | Done once or per-tenant |
|---|---|---|
| DNS (Cloudflare) | `A * → server IP` wildcard | **Once** |
| SSL (Certbot) | Wildcard cert `*.mcdms.com` | **Once** (auto-renews) |
| Nginx | Regex captures slug as `$subdomain` | **Once** |
| Express | `resolveTenant` middleware | **Once** |
| Database | `Tenant.slug` column | Per registration |
| Redis | Tenant slug cache, 10-min TTL | Auto-managed |

Zero infrastructure changes are needed when a new company registers.

---

## 8. Module-by-Module API Design

### 8.1 Waitlist & Pre-Launch

```
POST   /api/v1/waitlist              — Public. Submit waitlist application.
GET    /api/v1/admin/waitlist        — Super Admin. List all entries.
PATCH  /api/v1/admin/waitlist/:id/invite — Super Admin. Send invite.
```

**Invite flow:**
```
Super Admin invites company
      ├── Status → INVITED
      ├── One-time signup token stored in Redis (TTL 48hrs)
      └── Invite email sent: https://{slug}.mcdms.com/onboarding?token=xxx
```

---

### 8.2 Onboarding & Subscription

**Step 1 — Company Registration:**
```
POST /api/v1/auth/onboard
Body: { token, companyName, slug, adminEmail, adminPassword, adminFirstName, adminLastName, phone }
```
- Validates Redis token
- Creates `Tenant` + `User` (ADMIN, isOwner: true) + `TenantSettings` atomically in one DB transaction
- Sets `TenantStatus = TRIAL`, `trialEndsAt = now + 14 days`
- Issues Access + Refresh tokens

**Step 2 — Plan Selection:**
```
GET  /api/v1/subscriptions/plans       — List plans and pricing
POST /api/v1/subscriptions/initiate    — Admin only. Choose plan + billing cycle.
```

**Step 3 — Payment Confirmation:**
```
POST /api/v1/webhooks/paystack         — Paystack webhook
POST /api/v1/webhooks/flutterwave      — Flutterwave webhook
```
On success: `Subscription.status = ACTIVE`, `Tenant.status = ACTIVE`, welcome email enqueued.

**Subscription management:**
```
GET    /api/v1/subscriptions/current   — Current plan & status
POST   /api/v1/subscriptions/upgrade   — Upgrade with proration
POST   /api/v1/subscriptions/cancel    — Cancel at period end
GET    /api/v1/subscriptions/invoices  — Payment history
```

---

### 8.3 Fleet & Global Dashboard

```
GET /api/v1/dashboard/summary
```

Response is scoped by role — Marine Superintendent sees only their assigned vessels:

```json
{
  "fleetCompliancePercent": 87.4,
  "totalVessels": 12,
  "activeVessels": 10,
  "certificateStats": { "total": 240, "valid": 205, "expiringSoon": 22, "expired": 13 },
  "expiringByWindow": { "within7Days": 3, "within14Days": 7, "within30Days": 14, "within60Days": 22 },
  "renewalStageBreakdown": { "EXPIRY_IDENTIFIED": 5, "DOCUMENTS_REQUESTED": 4, "SUBMITTED_TO_AUTHORITY": 3 },
  "recentActivity": []
}
```

Cached in Redis per tenant (5 min TTL), invalidated on any certificate write.

---

### 8.4 Vessel Management

```
GET    /api/v1/vessels                               — List (scoped by role)
POST   /api/v1/vessels                               — Admin / Fleet Manager only
GET    /api/v1/vessels/:id                           — Vessel detail + summary
PATCH  /api/v1/vessels/:id                           — Update vessel
PATCH  /api/v1/vessels/:id/superintendent            — Assign superintendent (Admin/FM only)
DELETE /api/v1/vessels/:id                           — Soft delete

GET    /api/v1/vessels/:id/certificates              — All certs
POST   /api/v1/vessels/:id/certificates              — Add cert
GET    /api/v1/vessels/:id/certificates/:certId      — Single cert
PATCH  /api/v1/vessels/:id/certificates/:certId      — Update cert
DELETE /api/v1/vessels/:id/certificates/:certId      — Delete cert
POST   /api/v1/vessels/:id/certificates/:certId/upload — Upload cert file
```

Every vessel-specific write calls `getVesselOrThrow()` first to enforce superintendent scoping.

---

### 8.5 Excel Data Migration Wizard

```
POST /api/v1/migration/upload               — Upload .xlsx, returns jobId + preview
GET  /api/v1/migration/jobs/:jobId          — Poll import progress
POST /api/v1/migration/jobs/:jobId/confirm  — Confirm and start import
POST /api/v1/migration/jobs/:jobId/abort    — Cancel import
```

**Flow:**
```
Upload → Parse with exceljs (streaming) → Store preview in Redis (1hr TTL)
      → User reviews 10-row preview in UI
      → Confirm → BullMQ job processes rows in batches of 100
                → Progress updates streamed via SSE
```

---

### 8.6 Crew Management

```
GET    /api/v1/crew                          — List crew (scoped by role)
POST   /api/v1/crew                          — HR Manager / Admin / FM only
GET    /api/v1/crew/:id                      — Profile + current assignment
PATCH  /api/v1/crew/:id                      — Update profile
DELETE /api/v1/crew/:id                      — Soft delete

POST   /api/v1/crew/:id/assign               — Assign to vessel
PATCH  /api/v1/crew/:id/assign/:assignmentId — Update / end assignment
POST   /api/v1/crew/:id/activate             — HR Manager activates login

GET    /api/v1/crew/me                       — Crew Member own profile
PATCH  /api/v1/crew/me                       — Crew Member updates own contact details
GET    /api/v1/crew/me/documents             — Own documents
GET    /api/v1/crew/me/assignments           — Own assignment history
```

---

### 8.7 Crew Documentation

```
GET    /api/v1/crew/:id/documents            — All documents
POST   /api/v1/crew/:id/documents            — Add document (HR Manager / Admin / FM)
GET    /api/v1/crew/:id/documents/:docId     — Single document
PATCH  /api/v1/crew/:id/documents/:docId     — Update
DELETE /api/v1/crew/:id/documents/:docId     — Delete
POST   /api/v1/crew/:id/documents/:docId/upload — Upload file
```

Uses the same `Certificate` model with `crewMemberId` set. Category: `COMPETENCY | MEDICAL | TRAVEL_DOCUMENT`.

---

### 8.8 Notification Configuration

```
GET   /api/v1/notifications/config    — Get settings (Admin / Fleet Manager)
PATCH /api/v1/notifications/config    — Update alert days + channels
GET   /api/v1/notifications/logs      — Notification history (paginated)
POST  /api/v1/notifications/test      — Send a test notification
```

---

### 8.9 Compliance Reporting

```
POST /api/v1/reports/generate          — Request report (async)
GET  /api/v1/reports/:jobId/status     — Poll status
GET  /api/v1/reports/:jobId/download   — Download completed report
GET  /api/v1/reports/history           — Past reports
```

Report types: `FLEET_STATUS | CERTIFICATE_EXPIRY | CREW_COMPLIANCE`
Formats: `PDF | EXCEL | CSV`

Reports are always async — generation takes 5–30 seconds for large fleets.

---

### 8.10 Document Repository

```
GET  /api/v1/documents                  — List with full filter set
GET  /api/v1/documents/:id              — Document detail
POST /api/v1/documents/presign          — Pre-signed upload URL
DEL  /api/v1/documents/:id              — Soft delete + S3 cleanup
GET  /api/v1/documents/:id/versions     — Version history
POST /api/v1/documents/:id/versions     — Add new version
```

Query parameters: `?category=STATUTORY&vesselId=xxx&status=EXPIRING_SOON&keyword=ISM&page=1&limit=20&sortBy=expiresAt&order=asc`

---

### 8.11 Renewal Workflow Management

```
GET    /api/v1/renewals                  — All items (filterable by stage)
GET    /api/v1/renewals/:id              — Single item + history
POST   /api/v1/renewals                  — Manually create
PATCH  /api/v1/renewals/:id/stage        — Advance stage
POST   /api/v1/renewals/:id/comments     — Add comment
GET    /api/v1/renewals/kanban           — Kanban view grouped by stage
```

Stage transitions are linear and validated:
```
EXPIRY_IDENTIFIED → DOCUMENTS_REQUESTED → SUBMITTED_TO_AUTHORITY → UNDER_SURVEY → APPROVED → CLOSED
```

---

## 9. AI Integration Layer

### 9.1 Pluggable Provider Architecture

```
┌──────────────────────────────────────────┐
│            AiService (orchestrator)      │
│  .extractDocumentData(fileUrl, certId)   │
│  .generateComplianceSummary(tenantId)    │
│  .suggestRenewalActions(renewalItemId)   │
│  .queryDocuments(tenantId, query)        │
└──────────────┬───────────────────────────┘
               │
┌──────────────▼───────────────────────────┐
│         ILlmProvider interface           │
│  complete(prompt): Promise<string>       │
│  embed(text): Promise<number[]>          │
├──────────────────────────────────────────┤
│  OpenAIProvider | AnthropicProvider      │
│  GeminiProvider                          │
└──────────────────────────────────────────┘
```

### 9.2 AI Features

**Feature 1 — Document Extraction (OCR + Parse):** On certificate upload, a BullMQ job sends the file to the LLM to auto-fill expiry date, issuing authority, and certificate number. Runs async — user can review and override.

**Feature 2 — Compliance Summary:**
```
GET /api/v1/ai/compliance-summary?vesselId=xxx
```
Returns a natural language narrative: "MV Oloibiri has 3 certificates expiring within 30 days..."

**Feature 3 — Renewal Action Suggestions:**
```
POST /api/v1/ai/renewal-suggestions   Body: { renewalItemId }
```
Provides context-aware next steps based on certificate type and current stage.

**Feature 4 — Document Q&A (RAG):**
```
POST /api/v1/ai/query   Body: { query: "Which vessels have expired ISPS certificates?" }
```
Documents are chunked, embedded via `DocumentEmbedding` (pgvector), and used as context for grounded LLM answers.

### 9.3 AI Rate Limiting & Cost Control

```typescript
const key = `ai:budget:${tenantId}:${today}`;
const used = await redis.get(key);
if (Number(used) > DAILY_TOKEN_LIMIT[tenant.plan]) {
  throw new AppError('AI daily limit reached. Resets at midnight.', 429);
}
await redis.incrby(key, tokensUsed);
await redis.expireat(key, endOfDay());
```

---

## 10. Background Job Architecture (BullMQ)

### 10.1 Queue Map

| Queue | Jobs | Concurrency |
|---|---|---|
| `notification` | `scanner`, `send.email`, `send.sms`, `send.whatsapp` | scanner: 1, send: 10 |
| `migration` | `import.excel` | 2 |
| `report` | `generate.pdf`, `generate.excel`, `generate.csv` | 3 |
| `ai` | `doc.extract`, `embed.document`, `compliance.summary` | 5 |
| `webhook` | `deliver.event` | 10 |
| `email` | `transactional`, `waitlist.invite`, `onboarding` | 20 |
| `cleanup` | `purge.old.tokens`, `suspend.tenant`, `remove.soft.deleted` | 1 |

### 10.2 Repeatable Cron Jobs

```typescript
// Daily notification scan — 7:00 AM WAT
await notificationQueue.add('scanner', {}, {
  repeat: { cron: '0 6 * * *' },
  jobId: 'daily-notification-scan',
});

// Certificate status refresh — every 6 hours
await certQueue.add('refresh.statuses', {}, {
  repeat: { cron: '0 */6 * * *' },
  jobId: 'cert-status-refresh',
});

// Weekly cleanup — Sunday 2:00 AM
await cleanupQueue.add('purge.old.tokens', {}, {
  repeat: { cron: '0 2 * * 0' },
  jobId: 'weekly-token-purge',
});
```

### 10.3 Notification Scanner (Updated with Department Routing)

```typescript
async function scanExpiringCertificates() {
  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' } });

  for (const tenant of tenants) {
    const settings = await getTenantSettings(tenant.id);
    const alertDays = settings.alertDays ?? [60, 30, 14, 7];

    for (const days of alertDays) {
      const targetDate = addDays(new Date(), days);

      // Vessel certificates — route to Admin + Fleet Manager + assigned Superintendent
      const vesselCerts = await prisma.certificate.findMany({
        where: { tenantId: tenant.id, vesselId: { not: null },
                 expiresAt: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
                 status: { not: 'EXPIRED' } },
      });

      for (const cert of vesselCerts) {
        const recipients = await getVesselCertNotificationRecipients(tenant.id, cert.vesselId!);
        for (const recipient of recipients) {
          await notificationQueue.add('send.vessel.cert', { tenantId: tenant.id, certId: cert.id, recipientId: recipient.id, daysRemaining: days });
        }
      }

      // Crew documents — route to Admin + HR Managers + Superintendent of current vessel
      const crewDocs = await prisma.certificate.findMany({
        where: { tenantId: tenant.id, crewMemberId: { not: null },
                 expiresAt: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
                 status: { not: 'EXPIRED' } },
      });

      for (const doc of crewDocs) {
        const recipients = await getCrewDocNotificationRecipients(tenant.id, doc.crewMemberId!);
        for (const recipient of recipients) {
          await notificationQueue.add('send.crew.doc', { tenantId: tenant.id, docId: doc.id, recipientId: recipient.id, daysRemaining: days });
        }
      }
    }
  }
}
```

### 10.4 Job Retry Strategy

```typescript
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
};
```

---

## 11. Redis Usage Map

| Key Pattern | Purpose | TTL |
|---|---|---|
| `session:{userId}:{tokenId}` | Refresh token revocation check | 7 days |
| `onboard:token:{token}` | One-time waitlist signup token | 48 hours |
| `tenant:slug:{slug}` | Tenant resolution from subdomain | 10 minutes |
| `tenant:settings:{tenantId}` | Module entitlements + tenant settings | 5 minutes |
| `platform:settings` | Platform-wide settings singleton | 10 minutes |
| `dashboard:{tenantId}` | Dashboard summary cache | 5 minutes |
| `migration:{jobId}:preview` | Excel import preview rows | 1 hour |
| `migration:{jobId}:progress` | Import job progress (%) | 2 hours |
| `ratelimit:{ip}:{route}` | API rate limiting | 1 minute |
| `ratelimit:apikey:{keyId}` | Per-API-key rate limit | 1 minute |
| `ai:budget:{tenantId}:{date}` | Daily AI token usage counter | Until end of day |
| `cert:expiry:cache:{tenantId}` | Expiring certificate list | 10 minutes |
| `vessel:notifications:{vesselId}` | Notification recipients for a vessel | 10 minutes |
| `report:{jobId}:status` | Report generation status | 24 hours |
| `webhook:delivery:{deliveryId}:status` | Webhook delivery status | 24 hours |

---

## 12. File Storage Architecture

### Pre-Signed URL Strategy

Files under 5MB: server generates a pre-signed S3 PUT URL, client uploads directly to S3.
Files over 5MB: server proxies via multipart streaming.

```
S3 Bucket Structure:
tenants/{tenantId}/
  vessels/{vesselId}/certificates/{certId}/{filename}-{version}.pdf
  crew/{crewMemberId}/documents/{docId}/{filename}-{version}.pdf
  reports/{reportId}/fleet-status-2026-06.pdf
  migrations/{jobId}/import-source.xlsx
```

**Policy:** Always private. API responses return time-limited pre-signed GET URLs (1 hour TTL). Never expose raw S3 URLs.

---

## 13. Notification Service

### Channel Adapters

```typescript
interface INotificationChannel {
  send(recipient: string, payload: NotificationPayload): Promise<void>;
}

class EmailChannel implements INotificationChannel { /* AWS SES + EJS templates */ }
class SmsChannel implements INotificationChannel    { /* Termii API */ }
class WhatsAppChannel implements INotificationChannel { /* WhatsApp Business API */ }
```

### Email Templates

```
src/templates/emails/
  ├── vessel-cert-expiry-alert.ejs     — {vesselName, certName, daysLeft, expiresAt}
  ├── crew-doc-expiry-alert.ejs        — {crewName, docName, daysLeft, expiresAt}
  ├── waitlist-welcome.ejs
  ├── waitlist-invite.ejs
  ├── crew-account-invite.ejs
  ├── onboarding-welcome.ejs
  ├── subscription-confirmed.ejs
  ├── payment-receipt.ejs
  ├── payment-failed.ejs
  └── report-ready.ejs
```

---

## 14. Billing & Subscription Model

### 14.1 Billing Unit — Per Vessel (Fleet-Based)

MCDMS bills per **vessel count**, not per user. Users are unlimited across all plans. This aligns cost with the core value delivered (vessel compliance tracking) and avoids penalising companies for onboarding their full team.

### 14.2 Pricing Tiers

| Plan | Vessel Limit | Monthly (NGN) | Annual (NGN) | AI | Integrations |
|---|---|---|---|---|---|
| **Starter** | Up to 5 | ₦50,000 | ₦480,000 (save 20%) | ❌ | ❌ |
| **Growth** | Up to 20 | ₦150,000 | ₦1,440,000 (save 20%) | ✅ | ✅ |
| **Enterprise** | Unlimited | ₦400,000 | ₦3,840,000 (save 20%) | ✅ | ✅ |

### 14.3 Plan Enforcement at Vessel Creation

```typescript
const PLAN_VESSEL_LIMITS: Record<SubscriptionPlan, number> = {
  STARTER: 5, GROWTH: 20, ENTERPRISE: Infinity,
};

async createVessel(tenantId: string, dto: CreateVesselDto) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new AppError('No active subscription found.', 403);
  }

  const vesselCount = await prisma.vessel.count({
    where: { tenantId, status: { not: 'DECOMMISSIONED' } },
  });

  // Super Admin vessel override takes priority over plan default
  const settings = await getTenantSettings(tenantId);
  const limit = settings.vesselLimitOverride ?? PLAN_VESSEL_LIMITS[subscription.plan];

  if (vesselCount >= limit) {
    throw new AppError(`Your ${subscription.plan} plan supports up to ${limit} vessels. Please upgrade.`, 403);
  }

  return prisma.vessel.create({ data: { ...dto, tenantId } });
}
```

### 14.4 Pricing Constants

```typescript
// src/config/constants.ts (amounts in Kobo for Paystack)
export const PLAN_PRICING = {
  STARTER:    { MONTHLY: 5_000_000,  ANNUALLY: 48_000_000  },
  GROWTH:     { MONTHLY: 15_000_000, ANNUALLY: 144_000_000 },
  ENTERPRISE: { MONTHLY: 40_000_000, ANNUALLY: 384_000_000 },
};
export const TRIAL_DURATION_DAYS = 14;
```

### 14.5 Recurring Billing & Webhook Handling

```typescript
async function handlePaystackWebhook(event: PaystackEvent) {
  switch (event.event) {
    case 'charge.success':
      await prisma.subscription.update({
        where: { paymentReference: event.data.reference },
        data: { status: 'ACTIVE', currentPeriodStart: new Date(),
                currentPeriodEnd: addBillingPeriod(new Date(), subscription.billingCycle) },
      });
      await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
      await emailQueue.add('payment.receipt', { tenantId });
      break;

    case 'invoice.payment_failed':
      await prisma.subscription.update({ where: { tenantId }, data: { status: 'PAST_DUE' } });
      await emailQueue.add('payment.failed', { tenantId });
      // Suspend after 7-day grace period
      await cleanupQueue.add('suspend.tenant', { tenantId }, { delay: 7 * 24 * 60 * 60 * 1000 });
      break;

    case 'subscription.disable':
      await prisma.subscription.update({ where: { tenantId }, data: { status: 'CANCELLED', cancelAtPeriodEnd: true } });
      break;
  }
}
```

### 14.6 Plan Upgrade with Proration

```typescript
async upgradePlan(tenantId: string, newPlan: SubscriptionPlan) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  const totalDays = differenceInDays(new Date(sub.currentPeriodEnd), new Date(sub.currentPeriodStart));
  const remainingDays = differenceInDays(new Date(sub.currentPeriodEnd), new Date());
  const credit = (remainingDays / totalDays) * Number(sub.amount);
  const amountDue = Math.max(0, PLAN_PRICING[newPlan].MONTHLY / 100 - credit);

  // Charge amountDue via Paystack then update plan
  await prisma.subscription.update({ where: { tenantId }, data: { plan: newPlan } });
  await invalidateTenantSettingsCache(tenantId);
}
```

---

## 15. Admin Architecture — Super Admin vs Tenant Admin

### 15.1 Two Separate Admin Identities

| | Super Admin | Tenant Admin |
|---|---|---|
| **Who they are** | You — the MCDMS platform operator | The company's designated system owner |
| **Scope** | Entire platform | Their company only |
| **Stored in** | `SuperAdmin` table (no tenantId) | `User` table with `role: ADMIN` + `tenantId` |
| **Logs in at** | `admin.mcdms.com` | `{slug}.mcdms.com` |
| **Can see other tenants?** | ✅ All of them | ❌ Own company only |
| **Can manage billing?** | ✅ Platform-wide | ✅ Own subscription only |
| **Can invite users?** | ❌ Not inside tenants | ✅ Within their company |
| **Can suspend accounts?** | ✅ Any tenant | ❌ |
| **JWT scope** | `platform` | `tenant` |

### 15.2 Multiple Tenant Admins — Rules

**Rule 1 — Minimum one Admin must always exist:**
```typescript
async deactivateUser(tenantId: string, targetUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { tenantId, role: 'ADMIN', isActive: true } });
    if (adminCount <= 1) throw new AppError('Cannot deactivate the only Admin.', 400);
  }
  return prisma.user.update({ where: { id: targetUserId }, data: { isActive: false } });
}
```

**Rule 2 — Only an Admin can promote another user to Admin.**

**Rule 3 — The founding Admin gets `isOwner: true` — immune to demotion by other Admins.**

**Rule 4 — An Admin cannot change their own role.**

### 15.3 User Invitation Flow

```
Admin → User Management → Invite User (email, name, role)
      │
POST /api/v1/users/invite
      ├── Create User (isActive: false)
      ├── One-time invite token (Redis, TTL 48hrs)
      └── Email: https://{slug}.mcdms.com/accept-invite?token=xxx
                  └── User sets password → isActive = true → role-specific dashboard
```

### 15.4 Account Recovery

When the last Admin (or Owner) leaves the company:
```
PATCH /api/v1/admin/tenants/:tenantId/transfer-ownership
      ├── Old Owner: isOwner = false
      ├── New user: role = ADMIN, isOwner = true
      └── SuperAdminAuditLog entry created
```

---

## 16. Super Admin Control Plane & Feature Gating

### 16.1 Overview

The Super Admin operates the platform from `admin.mcdms.com`. Every tenant can be fully controlled without touching the database directly. All Super Admin actions are logged in `SuperAdminAuditLog` with before/after state.

### 16.2 Module Entitlements (Feature Gating)

Module entitlements are stored on `TenantSettings` and enforced by the `requireModule` middleware. When the Super Admin toggles a module off, the Redis settings cache is invalidated immediately — the gate closes on the next request.

Default entitlements by plan:

| Module | Starter | Growth | Enterprise |
|---|:---:|:---:|:---:|
| Fleet Dashboard | ✅ | ✅ | ✅ |
| Vessel Management | ✅ | ✅ | ✅ |
| Crew Management | ✅ | ✅ | ✅ |
| Excel Migration | ✅ | ✅ | ✅ |
| Document Repository | ✅ | ✅ | ✅ |
| Compliance Reporting | ✅ | ✅ | ✅ |
| Renewal Workflow | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| AI Features | ❌ | ✅ | ✅ |
| Integrations | ❌ | ✅ | ✅ |

### 16.3 Super Admin API Routes

```
// Tenant Management
GET    /api/v1/admin/tenants
GET    /api/v1/admin/tenants/:tenantId
PATCH  /api/v1/admin/tenants/:tenantId/modules           — Toggle modules
PATCH  /api/v1/admin/tenants/:tenantId/suspend
PATCH  /api/v1/admin/tenants/:tenantId/reactivate
PATCH  /api/v1/admin/tenants/:tenantId/quotas            — Override vessel limits
PATCH  /api/v1/admin/tenants/:tenantId/trial/extend
PATCH  /api/v1/admin/tenants/:tenantId/billing/freeze
PATCH  /api/v1/admin/tenants/:tenantId/plan/override

// User Controls
GET    /api/v1/admin/tenants/:tenantId/users
POST   /api/v1/admin/tenants/:tenantId/users/admin       — Add Admin (recovery)
PATCH  /api/v1/admin/tenants/:tenantId/users/:userId/deactivate
PATCH  /api/v1/admin/tenants/:tenantId/transfer-ownership

// Waitlist
GET    /api/v1/admin/waitlist
PATCH  /api/v1/admin/waitlist/:id/invite

// Platform Notices
POST   /api/v1/admin/notices/global
POST   /api/v1/admin/tenants/:tenantId/notice
DELETE /api/v1/admin/tenants/:tenantId/notice

// Platform Settings
GET    /api/v1/admin/platform-settings
PATCH  /api/v1/admin/platform-settings
PATCH  /api/v1/admin/platform-settings/pricing
PATCH  /api/v1/admin/platform-settings/modules
PATCH  /api/v1/admin/platform-settings/ai
PATCH  /api/v1/admin/platform-settings/notifications
PATCH  /api/v1/admin/platform-settings/security
PATCH  /api/v1/admin/platform-settings/storage
PATCH  /api/v1/admin/platform-settings/maintenance
POST   /api/v1/admin/platform-settings/propagate        — Apply change to all tenants on a plan

// Platform Analytics
GET    /api/v1/admin/analytics/overview
GET    /api/v1/admin/analytics/modules
GET    /api/v1/admin/analytics/vessels
```

---

## 17. Platform Settings & Tenant Settings

### 17.1 Settings Hierarchy

```
PLATFORM SETTINGS (Super Admin — admin.mcdms.com)
│
│  Controls globally:
│  ├── Plan pricing and vessel limits
│  ├── Default module entitlements per plan
│  ├── AI provider, model, and token budgets
│  ├── Available notification channels per plan
│  ├── File size limits and storage quotas per plan
│  ├── Security policy ceilings
│  ├── Waitlist / registration open/closed
│  ├── Maintenance mode and global announcements
│  └── Per-tenant overrides (vessel limits, plan override, billing freeze)
│
└── TENANT SETTINGS (Tenant Admin — {slug}.mcdms.com/settings)
       │
       │  Controls (within platform limits):
       ├── Company profile (logo, address, timezone, date format)
       ├── Notification preferences (channels, alert days, digest mode)
       ├── Additional alert email addresses (shared mailboxes)
       ├── Certificate rules (auto-renewal trigger, expiry threshold, require upload)
       ├── Vessel rules (require superintendent assignment)
       ├── Crew rules (auto-deactivate on contract end, allow self-update)
       ├── Security rules (session timeout, password expiry, IP whitelist)
       └── Reporting preferences (default format, scheduled reports)
```

### 17.2 Platform Settings Schema

```prisma
model PlatformSettings {
  id  String @id @default(cuid()) // Singleton — one row only

  // Pricing (in Kobo)
  starterMonthlyPriceKobo      Int @default(5000000)
  starterAnnualPriceKobo       Int @default(48000000)
  growthMonthlyPriceKobo       Int @default(15000000)
  growthAnnualPriceKobo        Int @default(144000000)
  enterpriseMonthlyPriceKobo   Int @default(40000000)
  enterpriseAnnualPriceKobo    Int @default(384000000)

  // Vessel limits
  starterVesselLimit     Int @default(5)
  growthVesselLimit      Int @default(20)
  enterpriseVesselLimit  Int @default(999999)

  // Trial
  defaultTrialDays       Int     @default(14)
  trialRequiresCard      Boolean @default(false)
  paymentGracePeriodDays Int     @default(7)

  // Payment providers
  paystackEnabled        Boolean @default(true)
  flutterwaveEnabled     Boolean @default(true)
  defaultCurrency        String  @default("NGN")

  // Module defaults per plan (Starter)
  starterModuleFleetDashboard     Boolean @default(true)
  starterModuleVesselManagement   Boolean @default(true)
  starterModuleCrewManagement     Boolean @default(true)
  starterModuleExcelMigration     Boolean @default(true)
  starterModuleDocumentRepository Boolean @default(true)
  starterModuleReporting          Boolean @default(true)
  starterModuleRenewalWorkflow    Boolean @default(true)
  starterModuleNotifications      Boolean @default(true)
  starterModuleAiFeatures         Boolean @default(false)
  starterModuleIntegrations       Boolean @default(false)

  // Module defaults per plan (Growth — same as above but AI + Integrations true)
  growthModuleAiFeatures          Boolean @default(true)
  growthModuleIntegrations        Boolean @default(true)
  // (All other Growth modules default true — same as Starter)

  // Module defaults per plan (Enterprise — all true)

  // AI settings
  aiProvider                      String  @default("openai")
  aiModel                         String  @default("gpt-4o")
  aiEnabled                       Boolean @default(true)
  aiDailyTokenLimitStarter        Int     @default(0)
  aiDailyTokenLimitGrowth         Int     @default(200000)
  aiDailyTokenLimitEnterprise     Int     @default(1000000)

  // Notification channels
  emailEnabled                    Boolean @default(true)
  smsEnabled                      Boolean @default(true)
  whatsappEnabled                 Boolean @default(false)
  defaultAlertDays                Int[]   @default([60, 30, 14, 7])
  starterSmsEnabled               Boolean @default(false)
  growthSmsEnabled                Boolean @default(true)
  enterpriseSmsEnabled            Boolean @default(true)
  enterpriseWhatsappEnabled       Boolean @default(true)

  // File storage
  maxFileSizeMb                   Int     @default(10)
  allowedFileTypes                String[] @default(["pdf","jpg","jpeg","png","xlsx","docx"])
  starterStorageQuotaMb           Int     @default(5120)
  growthStorageQuotaMb            Int     @default(51200)
  enterpriseStorageQuotaMb        Int     @default(0)

  // Security ceilings
  accessTokenTtlMinutes           Int     @default(15)
  refreshTokenTtlDays             Int     @default(7)
  maxLoginAttempts                Int     @default(5)
  lockoutDurationMinutes          Int     @default(30)
  passwordMinLength               Int     @default(8)
  apiRateLimitPerMinute           Int     @default(120)
  authRateLimitPerWindow          Int     @default(10)

  // Waitlist & registration
  waitlistEnabled                 Boolean @default(true)
  waitlistInviteTokenTtlHours     Int     @default(48)
  registrationOpen                Boolean @default(false)

  // Maintenance
  maintenanceMode                 Boolean @default(false)
  maintenanceMessage              String?
  platformAnnouncement            String?
  platformAnnouncementType        NoticeType?

  lastModifiedBy                  String
  updatedAt                       DateTime @updatedAt
  createdAt                       DateTime @default(now())
}
```

### 17.3 Tenant Settings Schema

```prisma
model TenantSettings {
  id       String @id @default(cuid())
  tenantId String @unique
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  // Module entitlements — Super Admin controlled only
  moduleFleetDashboard      Boolean @default(true)
  moduleVesselManagement    Boolean @default(true)
  moduleCrewManagement      Boolean @default(true)
  moduleExcelMigration      Boolean @default(true)
  moduleDocumentRepository  Boolean @default(true)
  moduleReporting           Boolean @default(true)
  moduleRenewalWorkflow     Boolean @default(true)
  moduleNotifications       Boolean @default(true)
  moduleAiFeatures          Boolean @default(false)
  moduleIntegrations        Boolean @default(false)

  // Quota overrides — Super Admin controlled only
  vesselLimitOverride       Int?
  storageQuotaMbOverride    Int?

  // Billing overrides — Super Admin controlled only
  trialExtendedTo           DateTime?
  planOverride              SubscriptionPlan?
  billingFrozen             Boolean  @default(false)

  // Company profile — Tenant Admin controlled
  companyLogo               String?
  companyAddress            String?
  companyWebsite            String?
  companyPhone              String?
  timezone                  String   @default("Africa/Lagos")
  dateFormat                String   @default("DD/MM/YYYY")
  language                  String   @default("en")

  // Notification preferences — Tenant Admin controlled
  emailNotificationsEnabled    Boolean @default(true)
  smsNotificationsEnabled      Boolean @default(false)
  whatsappNotificationsEnabled Boolean @default(false)
  alertDays                    Int[]   @default([60, 30, 14, 7])
  digestMode                   Boolean @default(false)
  digestSendTime               String  @default("07:00")
  additionalAlertEmails        String[] @default([])

  // Certificate rules — Tenant Admin controlled
  autoRenewalTriggerDays       Int     @default(90)
  expiringSoonThresholdDays    Int     @default(30)
  requireCertificateUpload     Boolean @default(false)

  // Vessel rules — Tenant Admin controlled
  requireSuperintendentAssignment Boolean @default(false)

  // Crew rules — Tenant Admin controlled
  autoDeactivateOnContractEnd  Boolean @default(true)
  deactivationGraceDays        Int     @default(0)
  allowCrewSelfUpdate          Boolean @default(true)

  // Security — Tenant Admin controlled (within platform ceilings)
  sessionTimeoutMinutes        Int     @default(60)
  enforcePasswordExpiry        Boolean @default(false)
  passwordExpiryDays           Int     @default(90)
  allowMultipleSessions        Boolean @default(true)
  ipWhitelist                  String[] @default([])

  // Reporting — Tenant Admin controlled
  defaultReportFormat          String   @default("PDF")
  autoScheduledReports         Boolean  @default(false)
  scheduledReportFrequency     String?
  scheduledReportDay           Int?
  scheduledReportRecipients    String[] @default([])

  // Platform notice — Super Admin only
  tenantNotice                 String?
  tenantNoticeType             NoticeType?

  lastModifiedBy               String
  lastModifiedAt               DateTime @updatedAt
  createdAt                    DateTime @default(now())
}

enum NoticeType {
  INFO
  WARNING
  DANGER
}
```

### 17.4 Tenant Settings API Routes

```
GET    /api/v1/settings                   — All tenant settings (Admin only)
PATCH  /api/v1/settings/company           — Company profile
PATCH  /api/v1/settings/notifications     — Notification preferences
PATCH  /api/v1/settings/documents         — Certificate rules
PATCH  /api/v1/settings/vessels           — Vessel rules
PATCH  /api/v1/settings/crew              — Crew rules
PATCH  /api/v1/settings/security          — Session & security rules
PATCH  /api/v1/settings/reports           — Reporting preferences
GET    /api/v1/settings/modules           — Module entitlements (read-only for tenant)
```

### 17.5 Settings Caching

```typescript
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const cached = await redis.get('platform:settings');
  if (cached) return JSON.parse(cached);
  const settings = await prisma.platformSettings.findFirst();
  await redis.set('platform:settings', JSON.stringify(settings), 'EX', 600);
  return settings!;
}

export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const cached = await redis.get(`tenant:settings:${tenantId}`);
  if (cached) return JSON.parse(cached);
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  await redis.set(`tenant:settings:${tenantId}`, JSON.stringify(settings), 'EX', 300);
  return settings!;
}

export async function invalidateTenantSettingsCache(tenantId: string) {
  await redis.del(`tenant:settings:${tenantId}`);
}
```

---

## 18. Third-Party HR Integration Layer

### 18.1 Overview

The integration layer (Growth + Enterprise only, gated behind `moduleIntegrations`) allows external HR platforms to exchange data with MCDMS bidirectionally via a **public API + webhook system**.

**Outbound (MCDMS → External):** MCDMS fires events when data changes.
**Inbound (External → MCDMS):** External systems push data into MCDMS using API keys.

### 18.2 API Key Scopes

```typescript
export const API_SCOPES = {
  'crew:read':    'Read crew member profiles and documents',
  'crew:write':   'Create and update crew members and documents',
  'vessels:read': 'Read vessel profiles and certificates',
  'vessels:write':'Create and update vessels and certificates',
  'reports:read': 'Generate and download compliance reports',
};
```

API keys are bcrypt-hashed. The plain key is shown **once** at creation and never retrievable again.

### 18.3 Outbound Webhook Events

```typescript
export const WEBHOOK_EVENTS = {
  'crew.created':                'A new crew member was created',
  'crew.updated':                'A crew member profile was updated',
  'crew.deactivated':            'A crew member was deactivated',
  'crew.assigned':               'Crew member assigned to a vessel',
  'crew.unassigned':             'Crew member removed from a vessel',
  'crew.document.uploaded':      'New crew document uploaded',
  'crew.document.expiring':      'Crew document expiring within alert window',
  'crew.document.expired':       'Crew document has expired',
  'crew.document.renewed':       'Crew document was renewed',
  'vessel.created':              'New vessel added',
  'vessel.updated':              'Vessel profile updated',
  'vessel.certificate.expiring': 'Vessel certificate expiring',
  'vessel.certificate.expired':  'Vessel certificate expired',
  'subscription.activated':      'Subscription became active',
  'subscription.past_due':       'Payment failed',
  'subscription.cancelled':      'Subscription cancelled',
};
```

### 18.4 Webhook Delivery with Exponential Backoff

```typescript
async function deliverWebhook(job: Job) {
  const { endpointId, event, payload, deliveryId } = job.data;
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
  if (!endpoint?.isActive) return;

  const signature = crypto.createHmac('sha256', endpoint.secret)
    .update(JSON.stringify(payload)).digest('hex');

  try {
    const response = await axios.post(endpoint.url, payload, {
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-MCDMS-Event': event,
        'X-MCDMS-Signature': `sha256=${signature}`,
        'X-MCDMS-Delivery': job.id,
      },
    });
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'DELIVERED', statusCode: response.status, deliveredAt: new Date() },
    });
  } catch (error) {
    // Retry delays: 1min → 5min → 30min → 2hrs → 5hrs
    const retryDelays = [60, 300, 1800, 7200, 18000];
    const nextDelay = retryDelays[job.attemptsMade] ?? null;
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: nextDelay ? 'PENDING' : 'EXHAUSTED', nextRetryAt: nextDelay ? addSeconds(new Date(), nextDelay) : null },
    });
    if (nextDelay) throw error;
  }
}
```

### 18.5 Integration Management Routes

```
GET    /api/v1/integrations/api-keys
POST   /api/v1/integrations/api-keys
DELETE /api/v1/integrations/api-keys/:id

GET    /api/v1/integrations/webhooks
POST   /api/v1/integrations/webhooks
PATCH  /api/v1/integrations/webhooks/:id
DELETE /api/v1/integrations/webhooks/:id
POST   /api/v1/integrations/webhooks/:id/test
GET    /api/v1/integrations/webhooks/:id/deliveries
POST   /api/v1/integrations/webhooks/:id/deliveries/:deliveryId/replay

POST   /api/v1/integrations/inbound    — Receive external platform events
```

### 18.6 Pre-Built Connectors Roadmap

| Platform | Phase | Type | Syncs |
|---|---|---|---|
| BambooHR | Phase 2 | Bidirectional | Crew profiles, employment status |
| Workday | Phase 2 | Inbound | Employee onboarding → crew creation |
| SAP SuccessFactors | Phase 2 | Bidirectional | Crew records, contract dates |
| Microsoft Teams | Phase 2 | Outbound | Certificate expiry alerts |
| Slack | Phase 2 | Outbound | Compliance alerts |

---

## 19. Security Architecture

### 19.1 API Rate Limiting

```typescript
const publicLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, store: new RedisStore({ client: redis }) });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  store: new RedisStore({ client: redis }) });
const apiKeyLimiter  = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => req.apiKey.id, store: new RedisStore({ client: redis }) });
```

### 19.2 Input Validation (Zod)

```typescript
export const CreateCertificateSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.enum(['STATUTORY','CLASSIFICATION','OPERATIONAL','COMPETENCY','MEDICAL','TRAVEL_DOCUMENT']),
  issuingAuthority: z.string().min(2),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});
```

### 19.3 Webhook Signature Verification

```typescript
export function verifyPaystackWebhook(req: Request): boolean {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(req.body)).digest('hex');
  return hash === req.headers['x-paystack-signature'];
}
```

### 19.4 Sensitive Data

- Passwords: **bcrypt** (cost factor 12)
- API keys: **bcrypt** hashed, plain key shown once only
- All secrets in environment variables — never in code
- PII (passport numbers, DOB): column-level encryption via `prisma-field-encryption` (Phase 2)

---

## 20. Observability & Logging

### Structured Logging with Pino

```typescript
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      tenantId: req.tenantId,
      userId: req.user?.id,
      requestId: req.id,
    }),
  },
});
```

Every log includes: `tenantId`, `requestId`, `userId`, timestamp, level. Makes per-tenant tracing trivial in Datadog / Grafana Loki / CloudWatch.

### Health Check

```
GET /api/v1/health
→ { "status": "ok", "database": "connected", "redis": "connected", "queues": { "notification": "active" }, "uptime": 123456 }
```

---

## 21. Project Folder Structure

```
mcdms-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── config/
│   │   ├── env.ts              — Zod-validated env
│   │   └── constants.ts        — PLAN_PRICING, limits
│   │
│   ├── lib/
│   │   ├── prisma.ts           — Global + tenant-scoped client
│   │   ├── redis.ts
│   │   ├── logger.ts
│   │   ├── storage.ts          — S3 client + presign helpers
│   │   ├── mailer.ts
│   │   └── settings.ts         — getPlatformSettings(), getTenantSettings()
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── tenant.middleware.ts
│   │   ├── module.middleware.ts      — requireModule()
│   │   ├── authorize.middleware.ts   — authorize(), requireSuperAdmin(), requireTenantAdmin()
│   │   ├── apiKey.middleware.ts      — authenticateApiKey(), requireScope()
│   │   ├── vesselScope.middleware.ts — getVesselOrThrow()
│   │   ├── validate.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── audit.middleware.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── waitlist/
│   │   ├── subscription/
│   │   ├── fleet/
│   │   ├── vessel/
│   │   ├── certificate/
│   │   ├── crew/
│   │   ├── migration/
│   │   ├── notification/
│   │   │   ├── notification.service.ts   — getVesselCertNotificationRecipients()
│   │   │   │                               getCrewDocNotificationRecipients()
│   │   │   └── notification.routes.ts
│   │   ├── report/
│   │   ├── document/
│   │   ├── renewal/
│   │   ├── settings/
│   │   │   ├── tenantSettings.service.ts
│   │   │   └── tenantSettings.routes.ts
│   │   ├── admin/
│   │   │   ├── admin.controller.ts
│   │   │   ├── platformSettings.service.ts
│   │   │   └── admin.routes.ts
│   │   ├── integrations/
│   │   │   ├── integrations.service.ts
│   │   │   ├── webhook.service.ts
│   │   │   └── inbound/
│   │   │       ├── inbound.service.ts
│   │   │       └── mappers/
│   │   │           └── bamboohr.mapper.ts
│   │   └── ai/
│   │       ├── ai.service.ts
│   │       └── providers/
│   │           ├── ILlmProvider.ts
│   │           ├── openai.provider.ts
│   │           └── anthropic.provider.ts
│   │
│   ├── queues/
│   │   ├── index.ts
│   │   ├── schedulers.ts
│   │   └── workers/
│   │       ├── notification.worker.ts
│   │       ├── migration.worker.ts
│   │       ├── report.worker.ts
│   │       ├── ai.worker.ts
│   │       ├── webhook.worker.ts
│   │       └── cleanup.worker.ts
│   │
│   ├── templates/emails/
│   ├── types/
│   │   ├── express.d.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── pagination.ts
│   │   ├── dateHelpers.ts
│   │   └── crypto.ts
│   │
│   ├── app.ts          — Express app setup
│   ├── server.ts       — HTTP server entry point
│   └── worker.ts       — BullMQ worker entry point (separate process)
│
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

`server.ts` and `worker.ts` are separate entry points — API server and job workers run as independent processes and scale independently.

---

## 22. Environment Configuration

```bash
# App
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mcdms
# Enable pgvector: CREATE EXTENSION IF NOT EXISTS vector;

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<256-bit-random>
JWT_REFRESH_SECRET=<256-bit-random>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# AWS S3 / Cloudflare R2
S3_BUCKET=mcdms-files
S3_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_ENDPOINT=               # Set for R2 or MinIO

# Payment
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

# Email (AWS SES)
SES_REGION=eu-west-1
SES_FROM_EMAIL=noreply@mcdms.com
# OR SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# SMS (Termii)
TERMII_API_KEY=
TERMII_FROM=MCDMS

# WhatsApp Business API
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# AI Provider
AI_PROVIDER=openai             # openai | anthropic | gemini
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL=gpt-4o

# App URL (used in invite links)
APP_URL=https://mcdms.com
ADMIN_URL=https://admin.mcdms.com
```

---

## 23. Trade-off Analysis

### 23.1 Modular Monolith vs. Microservices
**Decision:** Modular Monolith for MVP. Each module is self-contained with its own controller, service, schema, and routes — making future extraction clean when a module needs independent scaling (e.g. `report`, `ai`).

### 23.2 Shared Schema vs. Database-per-Tenant
**Decision:** Shared schema + Prisma client extension enforcing `tenantId`. Simpler to operate for MVP. Enterprise clients needing hard isolation can be offered a dedicated database tier without changing the service layer interface.

### 23.3 Sync API vs. Async Jobs for Heavy Operations
**Decision:** Reports, migrations, and AI extraction are always async via BullMQ. Prevents Node.js event loop blocking and avoids Nginx's 30-second timeout ceiling. Clients poll `/status` or subscribe to SSE.

### 23.4 pgvector vs. Dedicated Vector Database
**Decision:** pgvector for MVP RAG. No extra infrastructure to manage. Migrate to Pinecone/Qdrant when document corpus exceeds ~500,000 chunks or similarity search latency exceeds 100ms.

### 23.5 Per-Vessel vs. Per-User Billing
**Decision:** Per vessel. Aligns cost with value delivered (compliance tracking is vessel-centric). Avoids penalising companies for onboarding their full team. Users are unlimited across all plans.

### 23.6 Subdomain vs. Path-Based Tenancy
**Decision:** Subdomain routing. Produces cleaner URLs, enables future white-labelling, and is the industry standard (Slack, Notion, Jira). Zero infrastructure changes needed per new tenant.

### 23.7 EJS vs. React Email for Transactional Emails
**Decision:** EJS for MVP (simpler, no compilation step). Migrate to React Email in Phase 2 when a unified design system for emails is needed.

### 23.8 Paystack vs. Flutterwave
**Decision:** Support both, default to Paystack. Paystack has a cleaner developer experience for Nigerian SaaS. Flutterwave covers more African markets for future expansion. Both are abstracted behind a provider interface.

---

## 24. Blue-Green Deployment Strategy

### 24.1 Overview & Why It Solves the Downtime Problem

The current deployment flow — GitHub pushes code, GitHub Actions SSHes into the VPS, stops the running PM2 process, pulls new code, rebuilds, and restarts — produces downtime because there is a gap between the old process stopping and the new one being ready to serve traffic.

**Blue-Green deployment eliminates this gap** by keeping two deployment slots on the same VPS. One slot is always live and serving traffic (the active slot). The new version is deployed to the inactive slot, fully started and health-checked, and only then does Nginx switch traffic to it — in a single atomic operation with no dropped connections. The old slot stays running briefly as an instant rollback target.

```
BEFORE (current — has downtime):
  GitHub Push → Stop PM2 → Pull code → Build → Start PM2
                             ↑
                          DOWNTIME GAP

AFTER (blue-green — zero downtime):
  GitHub Push → Deploy to INACTIVE slot → Health check passes
              → Nginx switches traffic (atomic) → Stop old slot
                ↑
           Old slot still live during entire process
```

---

### 24.2 Deployment Flow Diagram

```
You push to main
        │
GitHub Actions: run tests + build
        │
        ├── Tests FAIL → deployment aborts → old slot still live ✅
        │
        └── Tests PASS →
                │
        Copy build to /var/www/mcdms-deploy-staging on VPS
                │
        deploy.sh runs on VPS:
                │
                ├── Read /var/www/deployment-state → "blue is live"
                ├── Target: green (port 3002)
                │
                ├── rsync code into /var/www/mcdms-green/
                ├── npm ci + npm run build
                ├── npx prisma migrate deploy
                ├── PM2 starts mcdms-green on port 3002
                │
                ├── Health check: GET http://localhost:3002/api/v1/health
                │       ├── FAIL (10 attempts) → stop green → exit 1
                │       │         Blue still live — automatic rollback ✅
                │       │
                │       └── PASS →
                │               │
                │       Rewrite /etc/nginx/mcdms-active-upstream.conf
                │       → upstream mcdms_active { server 127.0.0.1:3002; }
                │               │
                │       nginx -s reload   ← zero downtime, no dropped connections
                │               │
                │       Write "green" → /var/www/deployment-state
                │               │
                │       PM2 stop mcdms-blue
                │
                └── ✅ Green is now LIVE. Blue is stopped, ready for next deploy.

Next push: deploys to blue, switches back. Alternates every time.
```

---

### 24.3 VPS Initial Setup

Run these commands once on your VPS to set up the two-slot structure:

```bash
# Create deployment directories
mkdir -p /var/www/mcdms-blue
mkdir -p /var/www/mcdms-green
mkdir -p /var/www/mcdms-deploy-staging

# Create state file — tracks which slot is currently live
echo "blue" > /var/www/deployment-state

# Set correct permissions (replace 'deploy' with your VPS user)
chown -R deploy:deploy /var/www/mcdms-blue
chown -R deploy:deploy /var/www/mcdms-green
chown -R deploy:deploy /var/www/mcdms-deploy-staging
chown deploy:deploy /var/www/deployment-state

# Allow deploy user to reload nginx without a password
# Add this line to /etc/sudoers via: sudo visudo
# deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx
```

---

### 24.4 PM2 Ecosystem Files

Each slot has its own ecosystem file with a fixed port. These are committed to the repo.

```javascript
// ecosystem.blue.config.js
module.exports = {
  apps: [{
    name: 'mcdms-blue',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
```

```javascript
// ecosystem.green.config.js
module.exports = {
  apps: [{
    name: 'mcdms-green',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
    },
  }],
};
```

Bootstrap blue as the initial live slot on first setup:

```bash
cd /var/www/mcdms-blue
# Copy your .env file here first
pm2 start ecosystem.blue.config.js
pm2 save
pm2 startup    # so PM2 survives VPS reboots
```

---

### 24.5 Nginx Configuration

The key design is an **include file** that GitHub Actions rewrites on each deployment. This means only one line changes in Nginx config per deploy, which is what makes the traffic switch atomic.

```nginx
# /etc/nginx/sites-available/mcdms

# Static upstream definitions — these never change
upstream mcdms_blue {
    server 127.0.0.1:3001;
    keepalive 32;
}

upstream mcdms_green {
    server 127.0.0.1:3002;
    keepalive 32;
}

# The active upstream is controlled by this include file.
# The deployment script rewrites it on every deploy.
include /etc/nginx/mcdms-active-upstream.conf;

# Wildcard subdomain — tenant routing
server {
    listen 443 ssl;
    server_name ~^(?<subdomain>[a-z0-9-]+)\.mcdms\.com$;

    ssl_certificate     /etc/letsencrypt/live/mcdms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcdms.com/privkey.pem;

    location / {
        # mcdms_active resolves to whichever slot is live
        proxy_pass         http://mcdms_active;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Subdomain       $subdomain;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

# Admin portal
server {
    listen 443 ssl;
    server_name admin.mcdms.com;

    ssl_certificate     /etc/letsencrypt/live/mcdms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcdms.com/privkey.pem;

    location / {
        proxy_pass         http://mcdms_active;
        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        proxy_set_header   Host      $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name *.mcdms.com mcdms.com;
    return 301 https://$host$request_uri;
}
```

The include file that controls which upstream is active:

```nginx
# /etc/nginx/mcdms-active-upstream.conf
# Managed by the deployment pipeline — DO NOT edit manually.
# Current live slot: blue
upstream mcdms_active {
    server 127.0.0.1:3001;
}
```

Create this file once manually, then the deploy script owns it from that point forward:

```bash
echo 'upstream mcdms_active { server 127.0.0.1:3001; }' \
  > /etc/nginx/mcdms-active-upstream.conf

nginx -t && nginx -s reload
```

---

### 24.6 Deployment Script

This script lives on the VPS and is called by GitHub Actions on every push to main.

```bash
# /var/www/deploy.sh
#!/bin/bash
set -euo pipefail   # Exit on error, unset variables, pipe failures

LOG_FILE="/var/log/mcdms-deploy.log"
exec >> "$LOG_FILE" 2>&1   # Append all output to log file

echo ""
echo "========================================"
echo " MCDMS Deployment — $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ── 1. READ CURRENT LIVE SLOT ─────────────────────────────────────
CURRENT_SLOT=$(cat /var/www/deployment-state)
echo "[1/9] Current live slot: $CURRENT_SLOT"

if [ "$CURRENT_SLOT" = "blue" ]; then
    NEW_SLOT="green"
    NEW_PORT=3002
    ECOSYSTEM_FILE="ecosystem.green.config.js"
else
    NEW_SLOT="blue"
    NEW_PORT=3001
    ECOSYSTEM_FILE="ecosystem.blue.config.js"
fi

echo "      Deploying to: $NEW_SLOT (port $NEW_PORT)"
NEW_DIR="/var/www/mcdms-$NEW_SLOT"

# ── 2. SYNC CODE TO INACTIVE SLOT ─────────────────────────────────
echo "[2/9] Syncing code to $NEW_DIR..."
rsync -a --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='logs' \
    /var/www/mcdms-deploy-staging/ "$NEW_DIR/"

# Copy .env from live slot so new slot has same environment config
cp "/var/www/mcdms-$CURRENT_SLOT/.env" "$NEW_DIR/.env"
echo "      Code synced. .env copied from live slot."

# ── 3. INSTALL DEPENDENCIES ───────────────────────────────────────
echo "[3/9] Installing dependencies..."
cd "$NEW_DIR"
npm ci --omit=dev
echo "      Dependencies installed."

# ── 4. RUN DATABASE MIGRATIONS ────────────────────────────────────
echo "[4/9] Running Prisma migrations..."
npx prisma migrate deploy
echo "      Migrations complete."

# ── 5. START NEW SLOT ─────────────────────────────────────────────
echo "[5/9] Starting mcdms-$NEW_SLOT..."

# Stop and remove if a previous failed deploy left it running
pm2 stop  "mcdms-$NEW_SLOT" 2>/dev/null || true
pm2 delete "mcdms-$NEW_SLOT" 2>/dev/null || true

pm2 start "$ECOSYSTEM_FILE" --env production
echo "      mcdms-$NEW_SLOT started on port $NEW_PORT."

# ── 6. HEALTH CHECK ───────────────────────────────────────────────
echo "[6/9] Running health checks..."
HEALTH_URL="http://localhost:$NEW_PORT/api/v1/health"
MAX_ATTEMPTS=12      # 12 × 5s = 60 second window
ATTEMPT=0

until [ $ATTEMPT -ge $MAX_ATTEMPTS ]; do
    HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
        --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        echo "      ✅ Health check passed on attempt $((ATTEMPT + 1)) — status $HTTP_STATUS"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "      ⏳ Attempt $ATTEMPT/$MAX_ATTEMPTS — status: $HTTP_STATUS. Retrying in 5s..."
    sleep 5

    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo ""
        echo "      ❌ Health check FAILED after $MAX_ATTEMPTS attempts."
        echo "      Cleaning up failed slot: mcdms-$NEW_SLOT..."
        pm2 stop   "mcdms-$NEW_SLOT" 2>/dev/null || true
        pm2 delete "mcdms-$NEW_SLOT" 2>/dev/null || true
        echo "      ↩️  $CURRENT_SLOT is still live — no downtime occurred."
        exit 1
    fi
done

# ── 7. SWITCH NGINX TO NEW SLOT ───────────────────────────────────
echo "[7/9] Switching Nginx traffic to $NEW_SLOT (port $NEW_PORT)..."

sudo tee /etc/nginx/mcdms-active-upstream.conf > /dev/null <<EOF
# Managed by deployment pipeline — DO NOT edit manually.
# Current live slot: $NEW_SLOT
# Last deployed: $(date '+%Y-%m-%d %H:%M:%S')
upstream mcdms_active {
    server 127.0.0.1:$NEW_PORT;
}
EOF

# Validate config before reloading — if invalid, Nginx keeps running on old config
sudo nginx -t
sudo nginx -s reload   # Graceful reload — no dropped connections

echo "      ✅ Nginx now routing to $NEW_SLOT."

# ── 8. UPDATE STATE ───────────────────────────────────────────────
echo "[8/9] Updating deployment state..."
echo "$NEW_SLOT" > /var/www/deployment-state
pm2 save
echo "      State: $NEW_SLOT is now LIVE."

# ── 9. STOP OLD SLOT ──────────────────────────────────────────────
echo "[9/9] Draining and stopping old slot: mcdms-$CURRENT_SLOT..."
sleep 10   # Allow in-flight requests on the old slot to finish
pm2 stop   "mcdms-$CURRENT_SLOT"
pm2 delete "mcdms-$CURRENT_SLOT"
pm2 save

echo ""
echo "========================================"
echo " ✅ Deployment COMPLETE"
echo "    Live slot : $NEW_SLOT (port $NEW_PORT)"
echo "    Old slot  : $CURRENT_SLOT (stopped — rollback target)"
echo "    Time      : $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
```

```bash
# Make it executable
chmod +x /var/www/deploy.sh
```

---

### 24.7 Rollback Script

If you discover a problem after a deployment, run this manually to instantly revert:

```bash
# /var/www/rollback.sh
#!/bin/bash
set -euo pipefail

echo "========================================"
echo " MCDMS ROLLBACK — $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

CURRENT_SLOT=$(cat /var/www/deployment-state)
echo "Current live slot : $CURRENT_SLOT"

# Determine rollback target
if [ "$CURRENT_SLOT" = "blue" ]; then
    ROLLBACK_SLOT="green"
    ROLLBACK_PORT=3002
    ECOSYSTEM_FILE="ecosystem.green.config.js"
else
    ROLLBACK_SLOT="blue"
    ROLLBACK_PORT=3001
    ECOSYSTEM_FILE="ecosystem.blue.config.js"
fi

echo "Rolling back to   : $ROLLBACK_SLOT (port $ROLLBACK_PORT)"

# Start rollback slot if it is not already running
# (it should still have the previous version's code from the last deploy)
if ! pm2 list | grep -q "mcdms-$ROLLBACK_SLOT.*online"; then
    echo "Starting mcdms-$ROLLBACK_SLOT..."
    cd "/var/www/mcdms-$ROLLBACK_SLOT"
    pm2 start "$ECOSYSTEM_FILE" --env production
    sleep 5

    # Quick health check before switching
    HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
        "http://localhost:$ROLLBACK_PORT/api/v1/health" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" != "200" ]; then
        echo "❌ Rollback slot health check failed (status: $HTTP_STATUS)."
        echo "   Manual intervention required."
        exit 1
    fi
fi

# Switch Nginx
sudo tee /etc/nginx/mcdms-active-upstream.conf > /dev/null <<EOF
# Managed by deployment pipeline — DO NOT edit manually.
# Current live slot: $ROLLBACK_SLOT (ROLLBACK — $(date '+%Y-%m-%d %H:%M:%S'))
upstream mcdms_active {
    server 127.0.0.1:$ROLLBACK_PORT;
}
EOF

sudo nginx -t
sudo nginx -s reload

# Update state
echo "$ROLLBACK_SLOT" > /var/www/deployment-state
pm2 save

echo ""
echo "========================================"
echo " ✅ ROLLBACK COMPLETE"
echo "    Live slot : $ROLLBACK_SLOT (port $ROLLBACK_PORT)"
echo "    Time      : $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
```

```bash
chmod +x /var/www/rollback.sh

# To roll back at any time:
bash /var/www/rollback.sh
```

---

### 24.8 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    name: Test & Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build TypeScript
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            dist/
            package.json
            package-lock.json
            prisma/
            ecosystem.blue.config.js
            ecosystem.green.config.js
          retention-days: 3

  deploy:
    name: Blue-Green Deploy
    runs-on: ubuntu-latest
    needs: test   # Only runs if test job passes
    environment: production

    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: build-output

      - name: Copy build to VPS staging area
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          source: "dist/,package.json,package-lock.json,prisma/,ecosystem.*.config.js"
          target: "/var/www/mcdms-deploy-staging"
          rm: true

      - name: Run blue-green deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: bash /var/www/deploy.sh
          timeout: 300s

      - name: Verify deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            LIVE_SLOT=$(cat /var/www/deployment-state)
            echo "✅ Deployment verified — live slot: $LIVE_SLOT"
            pm2 list

      - name: Notify on failure
        if: failure()
        run: |
          echo "::error::Deployment failed. The previous slot is still live — no downtime occurred."
          echo "::notice::To roll back manually, SSH into VPS and run: bash /var/www/rollback.sh"
```

---

### 24.9 Required GitHub Secrets

Add these in your repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VPS_HOST` | Your VPS IP address or domain (e.g. `102.xxx.xxx.xxx`) |
| `VPS_USER` | SSH username (e.g. `root` or `deploy`) |
| `VPS_SSH_KEY` | Your **private** SSH key (the full contents of `~/.ssh/id_rsa`) |
| `VPS_PORT` | SSH port — `22` unless you changed it |

To generate a dedicated deploy key if you don't have one:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "mcdms-github-deploy" -f ~/.ssh/mcdms_deploy

# Copy public key to your VPS
ssh-copy-id -i ~/.ssh/mcdms_deploy.pub root@your-vps-ip

# Add the contents of ~/.ssh/mcdms_deploy (private key) to GitHub secret VPS_SSH_KEY
cat ~/.ssh/mcdms_deploy
```

---

### 24.10 Sudoers Configuration on VPS

The deploy script needs to reload Nginx without a password prompt. Add this once on your VPS:

```bash
sudo visudo
```

Add this line at the bottom (replace `deploy` with your VPS username):

```
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx
```

---

### 24.11 Optional Canary Extension

Once Blue-Green is working, you can layer canary traffic splitting on top by modifying the Nginx upstream weights before doing a full switch. This is optional and most useful when you want to validate a risky release against a small percentage of real traffic before committing fully.

```nginx
# Canary phase — 10% of traffic to new slot
upstream mcdms_active {
    server 127.0.0.1:3001 weight=9;   # old slot — 90%
    server 127.0.0.1:3002 weight=1;   # new slot — 10%
}
```

```bash
# /var/www/canary.sh — run manually between phases
#!/bin/bash
PHASE=${1:-""}

case "$PHASE" in
    "start")   BLUE=9; GREEN=1  ;;   # 10% canary
    "half")    BLUE=5; GREEN=5  ;;   # 50/50
    "finish")  BLUE=0; GREEN=1  ;;   # 100% new slot
    *)
        echo "Usage: bash canary.sh [start|half|finish]"
        exit 1 ;;
esac

sudo tee /etc/nginx/mcdms-active-upstream.conf > /dev/null <<EOF
upstream mcdms_active {
    server 127.0.0.1:3001 weight=$BLUE;
    server 127.0.0.1:3002 weight=$GREEN;
}
EOF

sudo nginx -t && sudo nginx -s reload
echo "✅ Traffic split — blue: $BLUE, green: $GREEN"
```

---

### 24.12 Deployment State at a Glance

| State | Blue (port 3001) | Green (port 3002) | Nginx active |
|---|---|---|---|
| Initial / after odd deploy | 🟢 LIVE | ⚫ Stopped | → 3001 |
| During even deploy | 🟢 LIVE (old) | 🔄 Starting up | → 3001 |
| After health check passes | 🟢 LIVE (old, draining) | 🟢 LIVE (new) | → 3002 |
| Deploy complete | ⚫ Stopped | 🟢 LIVE | → 3002 |
| After next deploy | 🔄 Starting up | 🟢 LIVE (old) | → 3002 |
| After next deploy complete | 🟢 LIVE (new) | ⚫ Stopped | → 3001 |

The slots alternate on every deployment. The stopped slot always retains the previous version's code, making rollback instant — just start it and switch Nginx.

---

### 24.13 Why Not Digital Ocean App Platform?

Digital Ocean App Platform handles zero-downtime deployments automatically but removes direct server control. For MCDMS on a single Droplet the Blue-Green approach above is the right choice because:

- Zero additional infrastructure cost — same Droplet, no extra servers
- Full control over Nginx, PM2, and deployment behaviour
- Rollback in under 30 seconds without waiting for a new container to build
- The scripts are written once and never need to be touched again
- Scales to a second Droplet + DO Load Balancer in future by simply pointing the load balancer at both slots

---

## 25. CI/CD Pipeline — Staging, Production & Local Commit Checks

### 25.1 Overview

The pipeline has three enforcement layers operating at different stages:

```
LOCAL MACHINE
      │
      ├── pre-commit hook (Husky + lint-staged)
      │     ├── ESLint + Prettier on changed files only
      │     └── TypeScript type check
      │
      ├── commit-msg hook (Husky + Commitlint)
      │     └── Enforce Conventional Commits format
      │
      └── pre-push hook (Husky)
            └── Full test suite before code leaves machine
                    │
                    └── git push → GitHub
                                │
                    ┌───────────┴────────────┐
                    │                        │
              PR → main               Merge → main
                    │                        │
         GitHub Actions:            GitHub Actions:
         PR Checks + Staging        Production Blue-Green
         ├── Lint + type check      ├── Final quality gate
         ├── Full test suite        ├── Full test suite
         ├── Build check            ├── Build
         └── Deploy → staging       └── Blue-green → production
```

---

### 25.2 Tool Responsibilities

| Tool | Layer | Job |
|---|---|---|
| **Husky** | Local | Manages Git hooks — runs scripts before commits and pushes |
| **lint-staged** | Local | Runs linters only on changed files — keeps checks fast |
| **Commitlint** | Local + CI | Validates commit message format |
| **ESLint** | Local + CI | Catches code errors and enforces style rules |
| **Prettier** | Local + CI | Auto-formats code consistently |
| **GitHub Actions** | CI/CD | Runs full pipeline on PR and on merge to main |

---

### 25.3 Local Commit Checks — Installation

```bash
npm install --save-dev \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional \
  eslint \
  prettier \
  eslint-config-prettier \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin
```

Initialise Husky — creates `.husky/` and adds `"prepare": "husky"` to `package.json`. The prepare script runs automatically after `npm install`, so every developer who clones the repo gets hooks set up with no extra steps:

```bash
npx husky init
```

---

### 25.4 Commitlint Configuration

Enforces the **Conventional Commits** format on every commit message:
`<type>(<scope>): <subject>`

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',      // New feature
        'fix',       // Bug fix
        'docs',      // Documentation only
        'style',     // Formatting — no logic change
        'refactor',  // Code change that is neither fix nor feature
        'perf',      // Performance improvement
        'test',      // Adding or fixing tests
        'chore',     // Build process, tooling, dependencies
        'ci',        // CI/CD changes
        'revert',    // Revert a previous commit
        'wip',       // Work in progress — use sparingly
      ],
    ],
    'scope-case':        [2, 'always', 'lower-case'],
    'subject-empty':     [2, 'never'],
    'subject-case':      [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-min-length':[2, 'always', 5],
    'subject-max-length':[2, 'always', 72],
    'header-max-length': [2, 'always', 100],
  },
};
```

**Valid commit messages for MCDMS:**
```
feat(vessel): add superintendent assignment endpoint
fix(auth): resolve refresh token expiry edge case
feat(crew): implement optional crew member login flow
chore(deps): upgrade prisma to v6
ci(deploy): add blue-green deployment workflow
docs(api): update vessel certificate endpoints
test(notification): add department routing unit tests
refactor(settings): extract platform settings cache helper
```

**Rejected examples:**
```
updated stuff                         ← no type prefix
feat: Updated vessel management.      ← uppercase subject + period at end
FIX(Auth): resolve bug                ← uppercase type and scope
feat(vessel): x                       ← subject too short (min 5 chars)
```

---

### 25.5 ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',   // Must be last — disables rules conflicting with Prettier
  ],
  rules: {
    '@typescript-eslint/no-explicit-any':         'warn',
    '@typescript-eslint/no-unused-vars':          ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises':    'error',  // Catches unhandled promises
    'no-console':    ['warn', { allow: ['warn', 'error'] }],
    'no-debugger':   'error',
    'prefer-const':  'error',
    'no-var':        'error',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '!.eslintrc.js',
    '!commitlint.config.js',
  ],
};
```

---

### 25.6 Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```
# .prettierignore
dist/
node_modules/
*.sql
*.md
prisma/migrations/
```

---

### 25.7 lint-staged Configuration

Runs linters only on files staged for commit — not the entire codebase. This keeps the pre-commit hook fast even in a large project.

Add to `package.json`:

```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ],
    "src/**/*.{js,json}": [
      "prettier --write"
    ],
    "prisma/schema.prisma": [
      "npx prisma format"
    ]
  }
}
```

`--max-warnings=0` means ESLint warnings are treated as errors — no warnings slip into the codebase.

---

### 25.8 Husky Hooks

#### Pre-Commit Hook

Runs lint-staged (ESLint + Prettier on changed files) and TypeScript type check before every commit:

```bash
# .husky/pre-commit
#!/bin/sh

echo "🔍 Running pre-commit checks..."

# Lint and format changed files only
npx lint-staged
if [ $? -ne 0 ]; then
  echo "❌ Lint/format check failed. Fix the errors above before committing."
  exit 1
fi

# TypeScript type check — catches errors ESLint won't
echo "🔷 Running TypeScript type check..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Fix them before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed."
```

#### Commit-Msg Hook

Validates every commit message against Commitlint rules:

```bash
# .husky/commit-msg
#!/bin/sh

echo "📝 Validating commit message..."
npx --no -- commitlint --edit "$1"

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Commit message does not follow Conventional Commits format."
  echo ""
  echo "   Format : <type>(<scope>): <subject>"
  echo "   Example: feat(vessel): add superintendent assignment"
  echo ""
  echo "   Valid types: feat, fix, docs, style, refactor, perf,"
  echo "                test, chore, ci, revert, wip"
  echo ""
  exit 1
fi

echo "✅ Commit message is valid."
```

#### Pre-Push Hook

Runs the full test suite before code leaves your machine — the last local line of defense:

```bash
# .husky/pre-push
#!/bin/sh

echo "🚀 Running pre-push checks..."
echo "   Running full test suite — this may take a minute..."

npm test -- --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Fix them before pushing."
  exit 1
fi

echo "✅ All checks passed. Pushing to remote."
```

Make all hooks executable:

```bash
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
```

---

### 25.9 Package.json Scripts

```json
{
  "scripts": {
    "build":          "tsc",
    "start":          "node dist/server.js",
    "dev":            "ts-node-dev --respawn src/server.ts",
    "test":           "jest --runInBand",
    "test:watch":     "jest --watch",
    "test:coverage":  "jest --coverage",
    "lint":           "eslint src --max-warnings=0",
    "lint:fix":       "eslint src --fix",
    "format":         "prettier --write src",
    "format:check":   "prettier --check src",
    "type-check":     "tsc --noEmit",
    "prepare":        "husky"
  }
}
```

---

### 25.10 Staging Environment Setup on VPS

Staging runs on the same VPS as production but on a separate port, directory, and database. It is protected by HTTP basic auth so it is never publicly accessible.

```
Production:  /var/www/mcdms-blue + mcdms-green   ports 3001 / 3002
Staging:     /var/www/mcdms-staging               port  4000
```

**One-time VPS setup for staging:**

```bash
# Create staging directory
mkdir -p /var/www/mcdms-staging
mkdir -p /var/www/mcdms-staging-incoming

# Set up basic auth (prevents public access to staging)
sudo apt install apache2-utils -y
sudo htpasswd -c /etc/nginx/.htpasswd-staging mcdms
# Enter a strong password when prompted

# Create a separate staging database in PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE mcdms_staging;"
sudo -u postgres psql -c "CREATE USER mcdms_staging WITH PASSWORD 'staging_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mcdms_staging TO mcdms_staging;"
```

**Staging PM2 config:**

```javascript
// ecosystem.staging.config.js
module.exports = {
  apps: [{
    name: 'mcdms-staging',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'staging',
      PORT: 4000,
    },
  }],
};
```

**Staging Nginx vhost:**

```nginx
# /etc/nginx/sites-available/mcdms-staging
server {
    listen 443 ssl;
    server_name staging.mcdms.com
                ~^(?<subdomain>[a-z0-9-]+)\.staging\.mcdms\.com$;

    ssl_certificate     /etc/letsencrypt/live/mcdms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcdms.com/privkey.pem;

    # Basic auth — blocks public access to staging
    auth_basic           "MCDMS Staging Environment";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Subdomain       $subdomain;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Enable the staging vhost:

```bash
sudo ln -s /etc/nginx/sites-available/mcdms-staging \
           /etc/nginx/sites-enabled/mcdms-staging
sudo nginx -t && sudo nginx -s reload
```

**Staging deploy script — simple restart, no blue-green:**

```bash
# /var/www/deploy-staging.sh
#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/mcdms-staging-deploy.log"
exec >> "$LOG_FILE" 2>&1

echo ""
echo "========================================"
echo " MCDMS Staging Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

STAGING_DIR="/var/www/mcdms-staging"

echo "[1/5] Syncing code..."
rsync -a --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    /var/www/mcdms-staging-incoming/ "$STAGING_DIR/"

# Staging uses its own .env pointing to the staging database
cp "$STAGING_DIR/.env.staging" "$STAGING_DIR/.env"

echo "[2/5] Installing dependencies..."
cd "$STAGING_DIR"
npm ci --omit=dev

echo "[3/5] Running migrations on staging database..."
npx prisma migrate deploy

echo "[4/5] Restarting staging app..."
pm2 restart mcdms-staging 2>/dev/null || \
  pm2 start ecosystem.staging.config.js --env staging
pm2 save

echo "[5/5] Health check..."
sleep 4
HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    "http://localhost:4000/api/v1/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Staging deployment complete — healthy."
else
    echo "⚠️  Staging deployed but health check returned: $HTTP_STATUS"
    echo "   Check logs: pm2 logs mcdms-staging"
fi

echo "========================================"
```

```bash
chmod +x /var/www/deploy-staging.sh
```

---

### 25.11 GitHub Actions — PR to Main (Staging Pipeline)

Fires on every pull request targeting main. Deploys to staging only when all checks pass.

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks & Staging Deploy

on:
  pull_request:
    branches:
      - main

jobs:
  # ── Job 1: Code Quality ──────────────────────────────────────────
  quality:
    name: Lint, Format & Type Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate commit messages
        uses: wagoid/commitlint-github-action@v5
        with:
          configFile: commitlint.config.js

      - name: ESLint
        run: npm run lint

      - name: Prettier format check
        run: npm run format:check

      - name: TypeScript type check
        run: npm run type-check

  # ── Job 2: Tests ─────────────────────────────────────────────────
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    needs: quality

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: mcdms_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mcdms_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://mcdms_test:test_password@localhost:5432/mcdms_test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test-access-secret-min-32-chars-xx
      JWT_REFRESH_SECRET: test-refresh-secret-min-32-chars-x
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Prisma migrations on test DB
        run: npx prisma migrate deploy

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  # ── Job 3: Build Check ───────────────────────────────────────────
  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: staging-build
          path: |
            dist/
            package.json
            package-lock.json
            prisma/
            ecosystem.staging.config.js
          retention-days: 1

  # ── Job 4: Deploy to Staging ─────────────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [test, build]
    environment: staging

    steps:
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: staging-build

      - name: Copy build to VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "dist/,package.json,package-lock.json,prisma/,ecosystem.staging.config.js"
          target: "/var/www/mcdms-staging-incoming"
          rm: true

      - name: Run staging deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: bash /var/www/deploy-staging.sh
          timeout: 180s

      - name: Comment staging URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## ✅ Staging Deployment Successful\n\n` +
                    `**Staging URL:** https://staging.mcdms.com\n\n` +
                    `All checks passed. Review changes on staging before merging.`
            })
```

---

### 25.12 GitHub Actions — Merge to Main (Production Pipeline)

Fires when a PR is merged to main. Runs a final quality gate then triggers the blue-green production deployment from Section 24.

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  # ── Job 1: Final Quality Gate ────────────────────────────────────
  quality-gate:
    name: Final Quality Gate
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: mcdms_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mcdms_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    env:
      DATABASE_URL: postgresql://mcdms_test:test_password@localhost:5432/mcdms_test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test-access-secret-min-32-chars-xx
      JWT_REFRESH_SECRET: test-refresh-secret-min-32-chars-x
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Full quality check
        run: |
          npm run lint
          npm run type-check
          npm run format:check

      - name: Run migrations on test DB
        run: npx prisma migrate deploy

      - name: Run full test suite
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload production build artifact
        uses: actions/upload-artifact@v4
        with:
          name: production-build
          path: |
            dist/
            package.json
            package-lock.json
            prisma/
            ecosystem.blue.config.js
            ecosystem.green.config.js
          retention-days: 3

  # ── Job 2: Blue-Green Production Deploy ──────────────────────────
  deploy-production:
    name: Blue-Green Production Deploy
    runs-on: ubuntu-latest
    needs: quality-gate
    environment: production

    steps:
      - name: Download production build artifact
        uses: actions/download-artifact@v4
        with:
          name: production-build

      - name: Copy build to VPS staging area
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "dist/,package.json,package-lock.json,prisma/,ecosystem.*.config.js"
          target: "/var/www/mcdms-deploy-staging"
          rm: true

      - name: Run blue-green deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: bash /var/www/deploy.sh
          timeout: 300s

      - name: Verify production deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            LIVE_SLOT=$(cat /var/www/deployment-state)
            echo "✅ Production live slot: $LIVE_SLOT"
            pm2 list | grep mcdms

      - name: Automatic rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            echo "⚠️ Deployment failed — triggering automatic rollback..."
            bash /var/www/rollback.sh
```

---

### 25.13 Required GitHub Secrets

Add these in your repository under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `VPS_HOST` | VPS IP address or domain |
| `VPS_USER` | SSH username (`root` or dedicated deploy user) |
| `VPS_SSH_KEY` | Full contents of your private SSH key |
| `VPS_PORT` | SSH port — `22` unless changed |

Generate a dedicated deploy key (recommended over using your personal key):

```bash
# On your local machine
ssh-keygen -t ed25519 -C "mcdms-github-deploy" -f ~/.ssh/mcdms_deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/mcdms_deploy.pub root@your-vps-ip

# Print private key — paste this as the VPS_SSH_KEY GitHub secret
cat ~/.ssh/mcdms_deploy
```

---

### 25.14 Sudoers Configuration on VPS

The deploy scripts need to reload Nginx without a password prompt. Add this once:

```bash
sudo visudo
```

Add at the bottom (replace `deploy` with your actual VPS username):

```
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx
```

---

### 25.15 Branch Protection Rules on GitHub

Go to **Settings → Branches → Add branch protection rule** for `main`. This makes it physically impossible to push directly to main or merge a failing PR:

```
Branch name pattern: main

✅ Require a pull request before merging
✅ Require approvals: 1
✅ Require status checks to pass before merging:
      → Lint, Format & Type Check
      → Test Suite
      → Build Check
      → Deploy to Staging
✅ Require branches to be up to date before merging
✅ Do not allow bypassing the above settings
```

---

### 25.16 Complete Developer Workflow

```
1. Create feature branch
   git checkout -b feat/vessel-superintendent-assignment

2. Write code

3. Stage and commit
   git add .
   git commit -m "feat(vessel): add superintendent assignment endpoint"
         │
         ├── pre-commit fires:
         │     ├── lint-staged: ESLint + Prettier on changed files only
         │     └── tsc --noEmit: TypeScript type check
         │
         ├── commit-msg fires:
         │     └── Commitlint validates message format
         │
         └── ✅ Commit created if all pass

4. Push to remote
   git push origin feat/vessel-superintendent-assignment
         │
         └── pre-push fires:
               └── Full test suite runs locally
                     └── ✅ Pushed if tests pass

5. Open Pull Request → main on GitHub
         │
         └── GitHub Actions pr-checks.yml fires:
               ├── Job 1: Lint + format + type check + commitlint
               ├── Job 2: Full test suite (real Postgres + Redis)
               ├── Job 3: TypeScript build check
               └── Job 4: Deploy to staging.mcdms.com
                     └── Staging URL posted as PR comment ✅

6. Review changes on staging.mcdms.com

7. Get PR approved and merge to main
         │
         └── GitHub Actions deploy-production.yml fires:
               ├── Job 1: Final quality gate (lint + tests + build)
               └── Job 2: Blue-green production deployment
                     ├── New slot built and health-checked
                     ├── Nginx switches traffic (< 15ms)
                     └── ✅ Zero downtime — new code is live
```

---

### 25.17 Environment File Structure

Keep environment files clearly separated. Never commit any `.env` file to the repository.

```
.env                  ← local development (gitignored)
.env.example          ← committed — shows all required keys with empty values
.env.test             ← test environment (gitignored, used by Jest)

# On the VPS (managed manually, never in git)
/var/www/mcdms-blue/.env          ← production env
/var/www/mcdms-green/.env         ← production env (copied from blue on deploy)
/var/www/mcdms-staging/.env.staging ← staging env (separate DB, separate keys)
```

```bash
# .env.example — commit this to the repository
NODE_ENV=
PORT=

DATABASE_URL=
REDIS_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=
JWT_REFRESH_TTL=

S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_ENDPOINT=

PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=

SES_REGION=
SES_FROM_EMAIL=

TERMII_API_KEY=
TERMII_FROM=

WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

AI_PROVIDER=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL=

APP_URL=
ADMIN_URL=
```

---

*End of MCDMS Backend System Design v5.0*
