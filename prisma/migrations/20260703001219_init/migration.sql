CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('WAITLIST', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'INVITED', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FLEET_MANAGER', 'MARINE_SUPERINTENDENT', 'HR_MANAGER', 'CREW_MEMBER');

-- CreateEnum
CREATE TYPE "VesselStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "CertCategory" AS ENUM ('STATUTORY', 'CLASSIFICATION', 'OPERATIONAL', 'COMPETENCY', 'MEDICAL', 'TRAVEL_DOCUMENT');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNDER_RENEWAL', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RenewalStage" AS ENUM ('EXPIRY_IDENTIFIED', 'DOCUMENTS_REQUESTED', 'SUBMITTED_TO_AUTHORITY', 'UNDER_SURVEY', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('INFO', 'WARNING', 'DANGER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "phone" TEXT,
    "fleetSize" INTEGER,
    "notes" TEXT,
    "referral" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vessel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imoNumber" TEXT,
    "vesselType" TEXT NOT NULL,
    "flagState" TEXT NOT NULL,
    "grossTonnage" DECIMAL(10,2),
    "yearBuilt" INTEGER,
    "status" "VesselStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedSuperintendentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vesselId" TEXT,
    "crewMemberId" TEXT,
    "name" TEXT NOT NULL,
    "category" "CertCategory" NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,
    "fileKey" TEXT,
    "status" "CertStatus" NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificateId" TEXT,
    "name" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "passportNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VesselCrewAssignment" (
    "id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VesselCrewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "vesselId" TEXT,
    "stage" "RenewalStage" NOT NULL DEFAULT 'EXPIRY_IDENTIFIED',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalHistory" (
    "id" TEXT NOT NULL,
    "renewalItemId" TEXT NOT NULL,
    "fromStage" "RenewalStage",
    "toStage" "RenewalStage" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificateId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminAuditLog" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tenantId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "starterMonthlyPriceKobo" INTEGER NOT NULL DEFAULT 5000000,
    "starterAnnualPriceKobo" INTEGER NOT NULL DEFAULT 48000000,
    "growthMonthlyPriceKobo" INTEGER NOT NULL DEFAULT 15000000,
    "growthAnnualPriceKobo" INTEGER NOT NULL DEFAULT 144000000,
    "enterpriseMonthlyPriceKobo" INTEGER NOT NULL DEFAULT 40000000,
    "enterpriseAnnualPriceKobo" INTEGER NOT NULL DEFAULT 384000000,
    "starterVesselLimit" INTEGER NOT NULL DEFAULT 5,
    "growthVesselLimit" INTEGER NOT NULL DEFAULT 20,
    "enterpriseVesselLimit" INTEGER NOT NULL DEFAULT 999999,
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 14,
    "trialRequiresCard" BOOLEAN NOT NULL DEFAULT false,
    "paymentGracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "paystackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "flutterwaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "starterModuleFleetDashboard" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleVesselManagement" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleCrewManagement" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleExcelMigration" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleDocumentRepository" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleReporting" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleRenewalWorkflow" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleNotifications" BOOLEAN NOT NULL DEFAULT true,
    "starterModuleAiFeatures" BOOLEAN NOT NULL DEFAULT false,
    "starterModuleIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "growthModuleAiFeatures" BOOLEAN NOT NULL DEFAULT true,
    "growthModuleIntegrations" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiDailyTokenLimitStarter" INTEGER NOT NULL DEFAULT 0,
    "aiDailyTokenLimitGrowth" INTEGER NOT NULL DEFAULT 200000,
    "aiDailyTokenLimitEnterprise" INTEGER NOT NULL DEFAULT 1000000,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultAlertDays" INTEGER[] DEFAULT ARRAY[60, 30, 14, 7]::INTEGER[],
    "starterSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "growthSmsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enterpriseSmsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enterpriseWhatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
    "allowedFileTypes" TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'docx']::TEXT[],
    "starterStorageQuotaMb" INTEGER NOT NULL DEFAULT 5120,
    "growthStorageQuotaMb" INTEGER NOT NULL DEFAULT 51200,
    "enterpriseStorageQuotaMb" INTEGER NOT NULL DEFAULT 0,
    "accessTokenTtlMinutes" INTEGER NOT NULL DEFAULT 15,
    "refreshTokenTtlDays" INTEGER NOT NULL DEFAULT 7,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "apiRateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "authRateLimitPerWindow" INTEGER NOT NULL DEFAULT 10,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waitlistInviteTokenTtlHours" INTEGER NOT NULL DEFAULT 48,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "platformAnnouncement" TEXT,
    "platformAnnouncementType" "NoticeType",
    "lastModifiedBy" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleFleetDashboard" BOOLEAN NOT NULL DEFAULT true,
    "moduleVesselManagement" BOOLEAN NOT NULL DEFAULT true,
    "moduleCrewManagement" BOOLEAN NOT NULL DEFAULT true,
    "moduleExcelMigration" BOOLEAN NOT NULL DEFAULT true,
    "moduleDocumentRepository" BOOLEAN NOT NULL DEFAULT true,
    "moduleReporting" BOOLEAN NOT NULL DEFAULT true,
    "moduleRenewalWorkflow" BOOLEAN NOT NULL DEFAULT true,
    "moduleNotifications" BOOLEAN NOT NULL DEFAULT true,
    "moduleAiFeatures" BOOLEAN NOT NULL DEFAULT false,
    "moduleIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "vesselLimitOverride" INTEGER,
    "storageQuotaMbOverride" INTEGER,
    "trialExtendedTo" TIMESTAMP(3),
    "planOverride" "SubscriptionPlan",
    "billingFrozen" BOOLEAN NOT NULL DEFAULT false,
    "companyLogo" TEXT,
    "companyAddress" TEXT,
    "companyWebsite" TEXT,
    "companyPhone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "language" TEXT NOT NULL DEFAULT 'en',
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alertDays" INTEGER[] DEFAULT ARRAY[60, 30, 14, 7]::INTEGER[],
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "digestSendTime" TEXT NOT NULL DEFAULT '07:00',
    "additionalAlertEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoRenewalTriggerDays" INTEGER NOT NULL DEFAULT 90,
    "expiringSoonThresholdDays" INTEGER NOT NULL DEFAULT 30,
    "requireCertificateUpload" BOOLEAN NOT NULL DEFAULT false,
    "requireSuperintendentAssignment" BOOLEAN NOT NULL DEFAULT false,
    "autoDeactivateOnContractEnd" BOOLEAN NOT NULL DEFAULT true,
    "deactivationGraceDays" INTEGER NOT NULL DEFAULT 0,
    "allowCrewSelfUpdate" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "enforcePasswordExpiry" BOOLEAN NOT NULL DEFAULT false,
    "passwordExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "allowMultipleSessions" BOOLEAN NOT NULL DEFAULT true,
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultReportFormat" TEXT NOT NULL DEFAULT 'PDF',
    "autoScheduledReports" BOOLEAN NOT NULL DEFAULT false,
    "scheduledReportFrequency" TEXT,
    "scheduledReportDay" INTEGER,
    "scheduledReportRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenantNotice" TEXT,
    "tenantNoticeType" "NoticeType",
    "lastModifiedBy" TEXT NOT NULL DEFAULT 'system',
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_email_key" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_status_idx" ON "Waitlist"("status");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "Vessel_tenantId_idx" ON "Vessel"("tenantId");

-- CreateIndex
CREATE INDEX "Vessel_assignedSuperintendentId_idx" ON "Vessel"("assignedSuperintendentId");

-- CreateIndex
CREATE INDEX "Vessel_status_idx" ON "Vessel"("status");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_idx" ON "Certificate"("tenantId");

-- CreateIndex
CREATE INDEX "Certificate_vesselId_idx" ON "Certificate"("vesselId");

-- CreateIndex
CREATE INDEX "Certificate_crewMemberId_idx" ON "Certificate"("crewMemberId");

-- CreateIndex
CREATE INDEX "Certificate_expiresAt_idx" ON "Certificate"("expiresAt");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_certificateId_idx" ON "Document"("certificateId");

-- CreateIndex
CREATE INDEX "DocumentEmbedding_tenantId_idx" ON "DocumentEmbedding"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentEmbedding_documentId_idx" ON "DocumentEmbedding"("documentId");

-- CreateIndex
CREATE INDEX "CrewMember_tenantId_idx" ON "CrewMember"("tenantId");

-- CreateIndex
CREATE INDEX "VesselCrewAssignment_crewMemberId_idx" ON "VesselCrewAssignment"("crewMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "VesselCrewAssignment_vesselId_crewMemberId_startDate_key" ON "VesselCrewAssignment"("vesselId", "crewMemberId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalItem_certificateId_key" ON "RenewalItem"("certificateId");

-- CreateIndex
CREATE INDEX "RenewalItem_tenantId_idx" ON "RenewalItem"("tenantId");

-- CreateIndex
CREATE INDEX "RenewalItem_vesselId_idx" ON "RenewalItem"("vesselId");

-- CreateIndex
CREATE INDEX "RenewalItem_stage_idx" ON "RenewalItem"("stage");

-- CreateIndex
CREATE INDEX "RenewalItem_dueDate_idx" ON "RenewalItem"("dueDate");

-- CreateIndex
CREATE INDEX "RenewalHistory_renewalItemId_idx" ON "RenewalHistory"("renewalItemId");

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_idx" ON "NotificationLog"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationLog_certificateId_idx" ON "NotificationLog"("certificateId");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_tenantId_idx" ON "AiInteraction"("tenantId");

-- CreateIndex
CREATE INDEX "AiInteraction_userId_idx" ON "AiInteraction"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_superAdminId_idx" ON "SuperAdminAuditLog"("superAdminId");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_tenantId_idx" ON "SuperAdminAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_createdAt_idx" ON "SuperAdminAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vessel" ADD CONSTRAINT "Vessel_assignedSuperintendentId_fkey" FOREIGN KEY ("assignedSuperintendentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEmbedding" ADD CONSTRAINT "DocumentEmbedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselCrewAssignment" ADD CONSTRAINT "VesselCrewAssignment_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselCrewAssignment" ADD CONSTRAINT "VesselCrewAssignment_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalItem" ADD CONSTRAINT "RenewalItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalItem" ADD CONSTRAINT "RenewalItem_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalItem" ADD CONSTRAINT "RenewalItem_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalHistory" ADD CONSTRAINT "RenewalHistory_renewalItemId_fkey" FOREIGN KEY ("renewalItemId") REFERENCES "RenewalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminAuditLog" ADD CONSTRAINT "SuperAdminAuditLog_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
