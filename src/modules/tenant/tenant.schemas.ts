import { z } from 'zod';

const nullableString = (max: number) => z.string().max(max).nullable();

export const updateTenantProfileSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: nullableString(50).optional(),
    companyLogo: nullableString(500).optional(),
    companyAddress: nullableString(500).optional(),
    companyWebsite: z.string().url().max(500).nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
    dateFormat: z.string().min(1).max(30).optional(),
    language: z.string().min(2).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one profile field is required',
  });
