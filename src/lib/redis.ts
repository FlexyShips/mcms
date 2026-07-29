import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

redis.on("error", (error) => {
  logger.error({ error }, "Redis error");
});

export async function connectRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") {
    return;
  }

  await redis.connect();
}

export async function checkRedisConnection(): Promise<
  "connected" | "disconnected"
> {
  try {
    if (redis.status !== "ready") {
      await connectRedis();
    }

    await redis.ping();
    return "connected";
  } catch (error) {
    logger.error({ error }, "Redis health check failed");
    return "disconnected";
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status !== "end") {
    await redis.quit();
  }
}
