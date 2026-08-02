import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectDatabase } from './lib/prisma.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { createApp } from './app.js';
import { startNotificationWorker } from './queues/worker.js';

const app = createApp();

try {
  await connectRedis();
  await startNotificationWorker();
} catch (error) {
  logger.warn(
    { error },
    'Redis was not available during startup; health check will report degraded',
  );
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MCDMS API server started');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down MCDMS API server');

  server.close(async () => {
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
