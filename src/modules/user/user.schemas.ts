import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'MARINE_SUPERINTENDENT', 'HR_MANAGER', 'CREW_MEMBER'])
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128)
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1)
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'MARINE_SUPERINTENDENT', 'HR_MANAGER', 'CREW_MEMBER'])
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(128)
});
