import { Worker, type Job } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { SignupStatus } from "../../generated/prisma/client.js";

const connection = { url: env.REDIS_URL };

const worker = new Worker(
  "cleanup",
  async (job: Job) => {
    const { name } = job;

    if (name === "expire-pending-signups") {
      await expirePendingSignups();
      return { expired: true };
    }

    return { skipped: true };
  },
  { connection, concurrency: 1 },
);

async function expirePendingSignups() {
  const now = new Date();

  const expired = await prisma.pendingSignup.updateMany({
    where: {
      status: { in: [SignupStatus.PENDING, SignupStatus.AWAITING_PAYMENT] },
      expiresAt: { lt: now },
    },
    data: { status: SignupStatus.EXPIRED },
  });

  logger.info(
    { count: expired.count },
    "Expired pending signups cleanup completed",
  );
}

export async function checkCleanupQueueConnection(): Promise<
  "connected" | "disconnected"
> {
  try {
    await worker.waitUntilReady();
    return "connected";
  } catch (error) {
    return "disconnected";
  }
}

worker.on("ready", () => {
  logger.info("Cleanup BullMQ worker is ready");
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobName: job?.name }, "Cleanup worker failed");
});
