import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  renderVesselReportCsv,
  renderVesselReportExcel,
  renderVesselReportPdf,
} from '../../modules/report/report.renderer.js';
import { buildVesselComplianceReport } from '../../modules/report/vessel-report.service.js';
import { logJobCompleted, logJobStarted } from '../job-logger.js';

const worker = new Worker(
  'report',
  async (job: Job<{ reportId: string }>) => {
    const startedAt = logJobStarted('report', job);
    const reportJob = await prisma.reportJob.findUnique({
      where: { id: job.data.reportId },
      include: { requester: { select: { id: true, role: true, isActive: true } } },
    });
    if (!reportJob) throw new Error(`Report ${job.data.reportId} no longer exists`);
    if (!reportJob.requester.isActive) throw new Error('Report requester is inactive');

    await prisma.reportJob.update({
      where: { id: reportJob.id },
      data: { status: 'PROCESSING', progress: 10, startedAt: new Date(), errorMessage: null },
    });

    try {
      const filters = reportJob.filters as {
        vesselId: string;
        asOf?: string;
        includeCrew?: boolean;
        includeRenewals?: boolean;
      };
      const report = await buildVesselComplianceReport({
        tenantId: reportJob.tenantId,
        vesselId: filters.vesselId,
        user: reportJob.requester,
        asOf: filters.asOf ? new Date(filters.asOf) : undefined,
        includeCrew: filters.includeCrew,
        includeRenewals: filters.includeRenewals,
      });
      await prisma.reportJob.update({ where: { id: reportJob.id }, data: { progress: 70 } });

      const rendered =
        reportJob.format === 'PDF'
          ? await renderVesselReportPdf(report)
          : reportJob.format === 'EXCEL'
            ? renderVesselReportExcel(report)
            : renderVesselReportCsv(report);
      await prisma.reportJob.update({
        where: { id: reportJob.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          fileName: rendered.fileName,
          mimeType: rendered.mimeType,
          sizeBytes: rendered.data.length,
          fileData: Uint8Array.from(rendered.data),
          completedAt: new Date(),
        },
      });
      const result = { reportId: reportJob.id, sizeBytes: rendered.data.length };
      logJobCompleted('report', job, startedAt, result);
      return result;
    } catch (error) {
      await prisma.reportJob.update({
        where: { id: reportJob.id },
        data: {
          status: 'FAILED',
          errorMessage: (error instanceof Error ? error.message : 'Report generation failed').slice(
            0,
            1000,
          ),
        },
      });
      throw error;
    }
  },
  { connection: { url: env.REDIS_URL }, concurrency: 2 },
);

worker.on('ready', () => logger.info('Report BullMQ worker is ready'));
worker.on('failed', (job, error) =>
  logger.error({ error, jobName: job?.name, reportId: job?.data.reportId }, 'Report worker failed'),
);

export default worker;
