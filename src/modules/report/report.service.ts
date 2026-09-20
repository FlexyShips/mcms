import { addDays } from 'date-fns';
import type { ReportStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { reportQueue } from '../../queues/queue.js';
import { HttpError } from '../../utils/httpError.js';
import { logTenantAudit } from '../../lib/audit.js';
import { buildVesselComplianceReport } from './vessel-report.service.js';

type Actor = { id: string; role: string };

export async function previewVesselReport(input: {
  tenantId: string;
  vesselId: string;
  user: Actor;
  asOf?: Date;
  includeCrew?: boolean;
  includeRenewals?: boolean;
}) {
  return buildVesselComplianceReport(input);
}

export async function requestReport(input: {
  tenantId: string;
  user: Actor;
  type: 'VESSEL_COMPLIANCE';
  format: 'PDF' | 'EXCEL' | 'CSV';
  vesselId: string;
  asOf?: Date;
  includeCrew: boolean;
  includeRenewals: boolean;
  ip?: string;
}) {
  await buildVesselComplianceReport({
    tenantId: input.tenantId,
    vesselId: input.vesselId,
    user: input.user,
    asOf: input.asOf,
    includeCrew: false,
    includeRenewals: false,
  });

  const filters = {
    vesselId: input.vesselId,
    asOf: input.asOf?.toISOString(),
    includeCrew: input.includeCrew,
    includeRenewals: input.includeRenewals,
  };
  const report = await prisma.reportJob.create({
    data: {
      tenantId: input.tenantId,
      requestedBy: input.user.id,
      type: input.type,
      format: input.format,
      filters,
      expiresAt: addDays(new Date(), 30),
    },
    select: reportMetadataSelect,
  });

  try {
    await reportQueue.add(
      'generate-vessel-compliance',
      { reportId: report.id },
      {
        jobId: report.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );
  } catch (error) {
    await prisma.reportJob.update({
      where: { id: report.id },
      data: { status: 'FAILED', errorMessage: 'Report queue is unavailable' },
    });
    throw error;
  }

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.user.id,
    action: 'REQUEST_VESSEL_REPORT',
    entity: 'ReportJob',
    entityId: report.id,
    after: { type: input.type, format: input.format, filters },
    ip: input.ip,
  });

  return report;
}

const reportMetadataSelect = {
  id: true,
  type: true,
  format: true,
  status: true,
  filters: true,
  progress: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getReport(tenantId: string, reportId: string) {
  const report = await prisma.reportJob.findFirst({
    where: { id: reportId, tenantId },
    select: reportMetadataSelect,
  });
  if (!report) throw new HttpError(404, 'Report not found', 'REPORT_NOT_FOUND');
  return report;
}

export async function listReports(input: {
  tenantId: string;
  page: number;
  limit: number;
  status?: ReportStatus;
}) {
  const where = { tenantId: input.tenantId, ...(input.status ? { status: input.status } : {}) };
  const [reports, total] = await Promise.all([
    prisma.reportJob.findMany({
      where,
      select: reportMetadataSelect,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.reportJob.count({ where }),
  ]);
  return { reports, pagination: { page: input.page, limit: input.limit, total } };
}

export async function getReportDownload(tenantId: string, reportId: string) {
  const report = await prisma.reportJob.findFirst({
    where: { id: reportId, tenantId },
    select: { status: true, fileData: true, fileName: true, mimeType: true, expiresAt: true },
  });
  if (!report) throw new HttpError(404, 'Report not found', 'REPORT_NOT_FOUND');
  if (report.expiresAt && report.expiresAt < new Date()) {
    throw new HttpError(410, 'Report download has expired', 'REPORT_EXPIRED');
  }
  if (report.status !== 'COMPLETED' || !report.fileData || !report.fileName || !report.mimeType) {
    throw new HttpError(409, 'Report is not ready for download', 'REPORT_NOT_READY');
  }
  return report;
}

export async function recordReportDownload(input: {
  tenantId: string;
  reportId: string;
  userId: string;
  ip?: string;
}) {
  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: 'DOWNLOAD_VESSEL_REPORT',
    entity: 'ReportJob',
    entityId: input.reportId,
    ip: input.ip,
  });
}
