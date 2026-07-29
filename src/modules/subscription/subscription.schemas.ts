import { z } from "zod";

export const initiateSubscriptionSchema = z.object({
  planId: z.string().min(1),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
});
