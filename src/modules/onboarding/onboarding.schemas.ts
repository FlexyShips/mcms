import { z } from 'zod';

export const onboardSchema = z.object({
  token: z.string().min(16),
  companyName: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional()
});
