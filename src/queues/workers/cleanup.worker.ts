import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { SignupStatus } from '../../generated/prisma/client.js';
import { logJobCompleted, logJobStarted } from '../job-logger.js';

const connection = { url: env.REDIS_URL };

const worker = new Worker(
  'cleanup',
  async (job: Job) => {
    const startedAt = logJobStarted('cleanup', job);
    const { name } = job;
    let result: Record<string, unknown>;

    if (name === 'expire-pending-signups') {
      result = await expirePendingSignups();
    } else {
      result = { skipped: true };
    }

    logJobCompleted('cleanup', job, startedAt, result);
    return result;
  },
  { connection, concurrency: 1 },
);

async function expirePendingSignups(): Promise<Record<string, unknown>> {
  const now = new Date();

  const expired = await prisma.pendingSignup.updateMany({
    where: {
      status: { in: [SignupStatus.PENDING, SignupStatus.AWAITING_PAYMENT] },
      expiresAt: { lt: now },
    },
    data: { status: SignupStatus.EXPIRED },
  });

  logger.info({ count: expired.count }, 'Expired pending signups cleanup completed');

  return { expired: true, count: expired.count };
}

export async function checkCleanupQueueConnection(): Promise<'connected' | 'disconnected'> {
  try {
    await worker.waitUntilReady();
    return 'connected';
  } catch (error) {
    return 'disconnected';
  }
}

worker.on('ready', () => {
  logger.info('Cleanup BullMQ worker is ready');
});

worker.on('failed', (job, err) => {
  logger.error({ err, jobName: job?.name }, 'Cleanup worker failed');
});
