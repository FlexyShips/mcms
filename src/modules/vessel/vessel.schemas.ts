import { z } from "zod";

export const createVesselSchema = z.object({
  name: z.string().min(1).max(200),
  imoNumber: z.string().max(50).optional(),
  vesselType: z.string().min(1).max(100),
  flagState: z.string().min(1).max(100),
  grossTonnage: z.number().optional(),
  yearBuilt: z.number().int().optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "UNDER_REPAIR", "DECOMMISSIONED"])
    .optional(),
  assignedSuperintendentId: z.string().min(1).optional(),
});

export const updateVesselSchema = createVesselSchema.partial();

export const assignSuperintendentSchema = z.object({
  superintendentId: z.string().min(1),
});

export const vesselIdParamsSchema = z.object({
  id: z.string().min(1),
});
