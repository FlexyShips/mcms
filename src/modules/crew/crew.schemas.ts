import { z } from 'zod';

export const createCrewSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  rank: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  nationality: z.string().max(100).optional(),
  passportNumber: z.string().max(100).optional(),
  dateOfBirth: z.string().datetime().optional(),
});

export const updateCrewSchema = createCrewSchema.partial();

export const assignCrewSchema = z.object({
  vesselId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export const crewIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const crewCertificateParamsSchema = z.object({
  id: z.string().min(1),
  certId: z.string().min(1),
});

export const crewDocumentParamsSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
});

export const crewCertificateSchema = z.object({
  name: z.string().min(1),
  category: z.enum([
    'STATUTORY',
    'CLASSIFICATION',
    'OPERATIONAL',
    'COMPETENCY',
    'MEDICAL',
    'TRAVEL_DOCUMENT',
  ]),
  issuingAuthority: z.string().min(1),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  notes: z.string().optional(),
  status: z.enum(['VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNDER_RENEWAL', 'SUSPENDED']).optional(),
});

export const crewDocumentSchema = z.object({
  certificateId: z.string().min(1),
  name: z.string().min(1),
  fileKey: z.string().min(1),
  fileUrl: z.string().url().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});
