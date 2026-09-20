import type { Request, Response } from 'express';
import * as reportService from './report.service.js';

export async function preview(req: Request, res: Response) {
  const query = req.query as unknown as {
    asOf?: Date;
    includeCrew?: boolean;
    includeRenewals?: boolean;
  };
  const report = await reportService.previewVesselReport({
    tenantId: req.tenantId!,
    vesselId: req.params.vesselId,
    user: req.user!,
    ...query,
  });
  res.json({ report });
}

export async function generate(req: Request, res: Response) {
  const report = await reportService.requestReport({
    tenantId: req.tenantId!,
    user: req.user!,
    ip: req.ip,
    ...req.body,
  });
  res.status(202).json({ report });
}

export async function status(req: Request, res: Response) {
  const report = await reportService.getReport(req.tenantId!, req.params.id);
  res.json({ report });
}

export async function history(req: Request, res: Response) {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  };
  const result = await reportService.listReports({ tenantId: req.tenantId!, ...query });
  res.json(result);
}

export async function download(req: Request, res: Response) {
  const report = await reportService.getReportDownload(req.tenantId!, req.params.id);
  await reportService.recordReportDownload({
    tenantId: req.tenantId!,
    reportId: req.params.id,
    userId: req.user!.id,
    ip: req.ip,
  });
  res.type(report.mimeType!);
  res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
  res.send(Buffer.from(report.fileData!));
}
