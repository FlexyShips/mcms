import { logger } from '../lib/logger.js';
import { connectRedis } from '../lib/redis.js';
import { cleanupQueue, notificationQueue, tenantExpirationQueue } from './queue.js';
import './workers/notification.worker.js';
import './workers/email.worker.js';
import './workers/tenant.expiration.worker.js';
import './workers/cleanup.worker.js';

let hasStarted = false;

export async function startNotificationWorker(): Promise<void> {
  if (hasStarted) {
    return;
  }

  await connectRedis();

  await notificationQueue.add(
    'scanner',
    { startedAt: new Date().toISOString() },
    {
      jobId: 'notification-scan-immediate',
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  );

  await notificationQueue.add(
    'scanner',
    {},
    {
      repeat: { pattern: '0 6 * * *' },
      // repeat: { pattern: '10 3 * * *' },

      jobId: 'daily-notification-scan',
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  );

  await tenantExpirationQueue.add(
    'expire-tenants',
    {},
    {
      repeat: { pattern: '0 6 * * *' },
      jobId: 'daily-tenant-expiration',
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  );

  await cleanupQueue.add(
    'expire-pending-signups',
    {},
    {
      repeat: { pattern: '0 6 * * *' },
      jobId: 'daily-cleanup-pending-signups',
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  );

  hasStarted = true;
  logger.info('BullMQ workers have been started');
}
