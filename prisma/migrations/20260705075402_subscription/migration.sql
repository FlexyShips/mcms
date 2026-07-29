/*
  Warnings:

  - You are about to drop the column `plan` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `planId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BillingCycle" ADD VALUE 'QUARTERLY';
ALTER TYPE "BillingCycle" ADD VALUE 'BIANNUALLY';

-- AlterEnum
ALTER TYPE "SubscriptionPlan" ADD VALUE 'TRIAL';

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "trialAnnualPriceKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialMonthlyPriceKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialVesselLimit" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "plan",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "planId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "gatewayPlanId" TEXT,
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
    "vesselLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingSignup" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "planId" TEXT,
    "cycle" "BillingCycle",
    "status" "SignupStatus" NOT NULL DEFAULT 'PENDING',
    "tenantId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupToken" (
    "id" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "Plan_name_idx" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "Plan_billingCycle_idx" ON "Plan"("billingCycle");

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignup_slug_key" ON "PendingSignup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignup_reference_key" ON "PendingSignup"("reference");

-- CreateIndex
CREATE INDEX "PendingSignup_status_expiresAt_idx" ON "PendingSignup"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PendingSignup_slug_idx" ON "PendingSignup"("slug");

-- CreateIndex
CREATE INDEX "PendingSignup_reference_idx" ON "PendingSignup"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SignupToken_token_key" ON "SignupToken"("token");

-- CreateIndex
CREATE INDEX "SignupToken_signupId_idx" ON "SignupToken"("signupId");

-- CreateIndex
CREATE INDEX "SignupToken_expiresAt_idx" ON "SignupToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSignup" ADD CONSTRAINT "PendingSignup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
