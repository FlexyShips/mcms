import { Router } from "express";
import { checkDatabaseConnection } from "../lib/prisma.js";
import { checkRedisConnection } from "../lib/redis.js";
import { checkNotificationQueueConnection } from "../queues/workers/notification.worker.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const [database, redis, notification] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
    checkNotificationQueueConnection(),
  ]);

  const healthy =
    database === "connected" &&
    redis === "connected" &&
    notification === "connected";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    database,
    redis,
    queues: {
      notification,
    },
    uptime: process.uptime(),
  });
});
