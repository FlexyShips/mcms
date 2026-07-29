import { z } from "zod";

export const notificationConfigSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  smsNotificationsEnabled: z.boolean().optional(),
  whatsappNotificationsEnabled: z.boolean().optional(),
  alertDays: z.array(z.number().int().positive()).optional(),
  digestMode: z.boolean().optional(),
  digestSendTime: z.string().optional(),
  additionalAlertEmails: z.array(z.string().email()).optional(),
});

export const notificationTestSchema = z.object({
  recipient: z.string().email(),
  channel: z.enum(["email", "sms", "whatsapp"]).optional(),
});
