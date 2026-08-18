import { z } from 'zod';

export const notificationConfigSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  smsNotificationsEnabled: z.boolean().optional(),
  whatsappNotificationsEnabled: z.boolean().optional(),
  alertDays: z.array(z.number().int().nonnegative()).min(1).optional(),
  digestMode: z.boolean().optional(),
  digestSendTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .optional(),
  additionalAlertEmails: z.array(z.string().email()).optional(),
});

export const notificationTestSchema = z.object({
  recipient: z.string().trim().min(1).optional(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'in_app']).default('email'),
});
