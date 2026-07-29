import { z } from "zod";

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
