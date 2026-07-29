import { z } from "zod";

export const renewalIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listRenewalsQuerySchema = z.object({
  stage: z
    .enum([
      "EXPIRY_IDENTIFIED",
      "DOCUMENTS_REQUESTED",
      "SUBMITTED_TO_AUTHORITY",
      "UNDER_SURVEY",
      "APPROVED",
      "CLOSED",
    ])
    .optional(),
  assignedTo: z.string().optional(),
});

export const createRenewalSchema = z.object({
  certificateId: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

export const advanceStageSchema = z.object({
  nextStage: z.enum([
    "EXPIRY_IDENTIFIED",
    "DOCUMENTS_REQUESTED",
    "SUBMITTED_TO_AUTHORITY",
    "UNDER_SURVEY",
    "APPROVED",
    "CLOSED",
  ]),
  comment: z.string().optional(),
});

export const addCommentSchema = z.object({
  comment: z.string().min(1),
});
