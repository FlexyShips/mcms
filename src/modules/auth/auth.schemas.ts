import { z } from 'zod';

export const loginSchema = z.object({
  tenantSlug: z.string().min(2).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1)
});
