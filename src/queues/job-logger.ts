import type { Job } from 'bullmq';
import { logger } from '../lib/logger.js';

export function logJobStarted(queueName: string, job: Job): number {
  const startedAt = Date.now();

  logger.info(
    {
      queueName,
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    },
    'Queue job started',
  );

  return startedAt;
}

export function logJobCompleted(
  queueName: string,
  job: Job,
  startedAt: number,
  result: Record<string, unknown>,
): void {
  logger.info(
    {
      queueName,
      jobId: job.id,
      jobName: job.name,
      durationMs: Date.now() - startedAt,
      ...result,
    },
    'Queue job completed',
  );
}
