-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('VESSEL_COMPLIANCE');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "vesselId" TEXT;

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "fileData" BYTEA,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_vesselId_idx" ON "Document"("vesselId");

-- CreateIndex
CREATE INDEX "ReportJob_tenantId_createdAt_idx" ON "ReportJob"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_requestedBy_createdAt_idx" ON "ReportJob"("requestedBy", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_status_idx" ON "ReportJob"("status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
