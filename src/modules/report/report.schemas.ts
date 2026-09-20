import { z } from 'zod';

const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const vesselReportParamsSchema = z.object({
  vesselId: z.string().min(1),
});

export const vesselReportPreviewQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
  includeCrew: booleanQuery.optional().default(true),
  includeRenewals: booleanQuery.optional().default(true),
});

export const generateReportSchema = z.object({
  type: z.literal('VESSEL_COMPLIANCE'),
  format: z.enum(['PDF', 'EXCEL', 'CSV']),
  vesselId: z.string().min(1),
  asOf: z.coerce.date().optional(),
  includeCrew: z.boolean().optional().default(true),
  includeRenewals: z.boolean().optional().default(true),
});

export const reportIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const reportHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});
