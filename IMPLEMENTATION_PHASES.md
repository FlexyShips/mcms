# MCDMS Backend Implementation Phases

This roadmap breaks the backend into buildable phases so implementation can move module by module without jumping across unrelated concerns.

## Phase 0: Project Foundation

Build this first because every other module depends on it.

### Modules

- Node.js, TypeScript, and Express setup
- Project folder structure
- Environment configuration
- Prisma setup
- PostgreSQL connection
- Redis connection
- Global error handler
- Request validation with Zod
- Health check endpoint
- Structured logging with Pino
- Basic rate limiting
- Docker Compose for local Postgres and Redis

### Deliverable

- App boots successfully
- `/api/v1/health` works
- Prisma can connect to PostgreSQL
- Redis can connect
- Base scripts are available in `package.json`

---

## Phase 1: Core Data Model

Create the database backbone before business logic.

### Modules

- Tenant
- Subscription
- Payment
- Waitlist
- User
- RefreshToken
- SuperAdmin
- Vessel
- Certificate
- Document
- DocumentEmbedding
- CrewMember
- VesselCrewAssignment
- RenewalItem
- RenewalHistory
- NotificationLog
- AiInteraction
- AuditLog
- SuperAdminAuditLog
- ApiKey
- WebhookEndpoint
- WebhookDelivery
- PlatformSettings
- TenantSettings

### Build Order

1. Tenant and Subscription
2. Users and Roles
3. Vessels
4. Crew
5. Certificates and Documents
6. Renewal workflow
7. Notifications and Audit
8. Integrations and Settings

### Deliverable

- Prisma schema implemented
- Initial migration created
- Seed script for platform settings, sample tenant, admin user, and sample vessel

---

## Phase 2: Tenancy, Auth & Access Control

This is the real platform foundation. Do not build operational APIs deeply before this.

### Modules

- Subdomain tenant resolution
- Tenant middleware
- Auth module
- JWT access token
- Refresh token rotation
- RBAC permissions
- Superintendent own-vessel scoping
- Tenant isolation enforcement

### Build Order

1. Tenant resolution middleware
2. Auth register/login/refresh/logout
3. Authenticated request context
4. Role middleware
5. Permission middleware
6. Vessel-scope middleware for superintendents

### Deliverable

- Users can log in
- Every request knows `tenantId`
- Tenant users cannot access other tenants' data
- Role restrictions work

---

## Phase 3: Platform Entry Flow

This phase handles how companies enter and activate the system.

### Modules

- Waitlist
- Onboarding
- Tenant creation
- Founding admin creation
- Subscription creation
- Billing plan limits
- Feature gating

### Build Order

1. Waitlist API
2. Tenant onboarding API
3. Subscription setup
4. Plan enforcement
5. Feature entitlement middleware

### Deliverable

- A company can join the waitlist
- Admin can create or activate a tenant
- Tenant gets an owner admin
- Plan limits can block actions like vessel creation

---

## Phase 4: Admin & User Management

Build this before operational modules get too complex.

### Modules

- Tenant admin user management
- User invitations
- Role assignment
- Account recovery
- Super admin login
- Super admin tenant management
- Audit logs

### Build Order

1. Tenant admin user CRUD
2. Invite user flow
3. Role update rules
4. Owner protection
5. Super admin auth
6. Super admin tenant/subscription controls
7. Audit logging

### Deliverable

- Tenant admins can manage their team
- Super admins can manage tenants
- Sensitive admin actions are audited

---

## Phase 5: Core Operations MVP

This is the heart of the product. These modules should sit next to each other.

### Modules

- Fleet dashboard
- Vessel management
- Crew management
- Crew assignment to vessels
- Vessel superintendent assignment

### Build Order

1. Vessel CRUD
2. Superintendent assignment
3. Crew member CRUD
4. Crew-to-vessel assignment
5. Fleet dashboard summary

### Deliverable

- Tenant can manage fleet
- Tenant can manage crew
- Superintendent can only see assigned vessels
- Dashboard can show operational counts

---

## Phase 6: Certificates, Documents & File Storage

This should come after vessels and crew because certificates attach to them.

### Modules

- Vessel certificates
- Crew documents
- Document repository
- S3/R2 file uploads
- Pre-signed URLs
- Certificate status calculation

### Build Order

1. File storage adapter
2. Upload pre-signed URL endpoint
3. Vessel certificate CRUD
4. Crew document CRUD
5. Document repository listing/search
6. Certificate expiry status logic

### Deliverable

- Users can upload certificate/document files
- Certificates can be linked to vessel or crew
- Expiry state is trackable

---

## Phase 7: Renewal Workflow

Build this once certificates and documents exist.

### Modules

- RenewalItem
- Renewal status transitions
- Assignment
- Notes
- Renewal history
- Compliance state updates

### Build Order

1. Auto-create renewal item from expiring certificate
2. Manual renewal item CRUD
3. Status transitions
4. Assignment to responsible user or department
5. Renewal completion updates certificate status

### Deliverable

- Expiring documents become actionable renewal work
- Users can track renewal lifecycle

---

## Phase 8: Notifications & Background Jobs

This depends on certificates, crew documents, renewal items, and role routing.

### Modules

- BullMQ queues
- Notification service
- Email/SMS/WhatsApp adapters
- Notification preferences
- Department routing
- Expiry scanner jobs
- Retry strategy

### Build Order

1. Queue setup
2. Notification model/API
3. Notification adapter interface
4. Email adapter first
5. Expiry scanner job
6. Department routing
7. SMS/WhatsApp adapters
8. Retry/dead-letter handling

### Deliverable

- System can detect expiring certificates
- Correct department/users are notified
- Notifications run asynchronously

---

## Phase 9: Reporting, Import & Migration

Useful after the main data flows are stable.

### Modules

- Compliance reporting
- Fleet reports
- Expiry reports
- Excel migration wizard
- Import queue
- Validation preview
- Import audit trail

### Build Order

1. Compliance report endpoints
2. CSV/Excel export
3. Excel upload
4. Parse and validate import file
5. Preview import errors
6. Commit import through queue

### Deliverable

- Tenant can see compliance reports
- Tenant can migrate old Excel data safely

---

## Phase 10: Billing & Payments

Some billing enforcement exists earlier, but full payment handling can come after MVP operations.

### Modules

- Paystack/Flutterwave integration
- Payment records
- Webhook verification
- Subscription renewal
- Plan upgrade/downgrade
- Proration
- Past-due handling

### Build Order

1. Payment initialization
2. Payment webhook verification
3. Payment status update
4. Subscription activation
5. Recurring billing logic
6. Plan upgrades
7. Tenant suspension rules

### Deliverable

- Tenants can pay
- Subscriptions update automatically
- Plan limits are enforced from real billing state

---

## Phase 11: Settings & Integrations

Build after the core app is stable because these extend behavior.

### Modules

- Platform settings
- Tenant settings
- Settings cache
- API keys
- Webhook endpoints
- Webhook delivery queue
- HR integration layer

### Build Order

1. Platform settings
2. Tenant settings
3. Settings cache in Redis
4. API key generation
5. API key scope middleware
6. Webhook registration
7. Webhook event delivery
8. HR integration endpoints

### Deliverable

- Tenants can configure behavior
- External systems can integrate with crew/document data

---

## Phase 12: AI Layer

Keep this late unless AI is a core selling point for the first release.

### Modules

- AI provider abstraction
- AI rate limiting
- Cost tracking
- Document embeddings
- Compliance assistant
- RAG over documents
- AI background jobs

### Build Order

1. AI provider interface
2. Provider config
3. AI usage logging
4. Rate/cost limits
5. Document embedding pipeline
6. AI assistant endpoints
7. AI report/document analysis jobs

### Deliverable

- AI can answer or analyze documents within tenant boundaries
- Usage is limited and auditable

---

## Phase 13: Hardening, CI/CD & Deployment

Do this throughout, but finish it seriously before production.

### Modules

- Tests
- ESLint/Prettier
- Husky hooks
- Commitlint
- GitHub Actions
- Staging deploy
- Production blue-green deploy
- Rollback script
- Nginx config
- Branch protection

### Build Order

1. Local test setup
2. Lint/typecheck scripts
3. Pre-commit/pre-push hooks
4. GitHub PR checks
5. Staging deployment
6. Production deployment
7. Blue-green switch
8. Rollback verification

### Deliverable

- PRs are tested automatically
- Staging is deployed before merge
- Production deploy has rollback path

---

## Recommended MVP Path

For the first working version, implement these phases first:

1. Phase 0: Project Foundation
2. Phase 1: Core Data Model
3. Phase 2: Tenancy, Auth & Access Control
4. Phase 3: Platform Entry Flow
5. Phase 5: Core Operations MVP
6. Phase 6: Certificates, Documents & File Storage
7. Phase 7: Renewal Workflow
8. Phase 8: Email notifications only
9. Phase 13: Basic CI/CD

Delay these until after MVP:

- AI
- WhatsApp/SMS
- HR integrations
- Full billing proration
- Excel migration wizard
- Blue-green production deployment if you are not deploying yet

## Simple Module Sequence

Use this as the shortest build order:

```text
foundation
database
tenant
auth
rbac
settings
billing-lite
waitlist
onboarding
users
super-admin
vessels
crew
certificates
documents
renewals
notifications
jobs
reports
imports
billing-full
integrations
ai
deployment
```

