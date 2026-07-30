import { z } from 'zod';

export const createWaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  fleetSize: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
  referral: z.string().max(200).optional(),
});

export const inviteWaitlistParamsSchema = z.object({
  id: z.string().min(1),
});

export const listWaitlistQuerySchema = z.object({
  status: z.enum(['PENDING', 'INVITED', 'CONVERTED', 'REJECTED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
