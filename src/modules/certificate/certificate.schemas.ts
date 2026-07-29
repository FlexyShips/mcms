import { z } from "zod";

export const certificateIdParamsSchema = z.object({
  vesselId: z.string().min(1),
  certId: z.string().min(1),
});

export const vesselCertificateParamsSchema = z.object({
  vesselId: z.string().min(1),
});

export const createCertificateSchema = z.object({
  name: z.string().min(1),
  category: z.enum([
    "STATUTORY",
    "CLASSIFICATION",
    "OPERATIONAL",
    "COMPETENCY",
    "MEDICAL",
    "TRAVEL_DOCUMENT",
  ]),
  issuingAuthority: z.string().min(1),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  notes: z.string().optional(),
  status: z
    .enum(["VALID", "EXPIRING_SOON", "EXPIRED", "UNDER_RENEWAL", "SUSPENDED"])
    .optional(),
});

export const updateCertificateSchema = createCertificateSchema.partial();

export const uploadCertificateSchema = z.object({
  fileUrl: z.string().url(),
  fileKey: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});
