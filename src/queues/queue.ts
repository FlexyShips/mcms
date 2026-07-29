import { Queue } from "bullmq";
import { env } from "../config/env.js";

export const notificationQueue = new Queue("notification", {
  connection: { url: env.REDIS_URL },
});

export const emailQueue = new Queue("email", {
  connection: { url: env.REDIS_URL },
});

export const cleanupQueue = new Queue("cleanup", {
  connection: { url: env.REDIS_URL },
});

export const tenantExpirationQueue = new Queue("tenantExpiration", {
  connection: { url: env.REDIS_URL },
});
