import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from './logger.js';
import { env } from '../config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const basePrisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'query' },
  ],
});

basePrisma.$on('error', (event) => {
  logger.error({ event }, 'Prisma error');
});

basePrisma.$on('warn', (event) => {
  logger.warn({ event }, 'Prisma warning');
});

basePrisma.$on('query', (event) => {
  let params: unknown = event.params;
  try {
    params = JSON.parse(event.params);
  } catch {
    // leave as raw string if parsing fails
  }

  logger.debug(
    {
      query: event.query,
      params,
      durationMs: event.duration,
      target: event.target,
    },
    'Prisma query',
  );
});

const readOperations = new Set([
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'findUnique',
  'findFirst',
  'findMany',
]);
const writeOperations = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'deleteManyAndReturn',
]);

export const prisma = basePrisma.$extends(
  Prisma.defineExtension({
    name: 'write-logger',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          // if (writeOperations.has(operation)) {
          //   logger.info(
          //     {
          //       model,
          //       operation,
          //       data: result,
          //     },
          //     "Database write",
          //   );
          // }
          // if (readOperations.has(operation)) {
          //   logger.info(
          //     {
          //       model,
          //       operation,
          //       data: result,
          //     },
          //     "Database read",
          //   );
          // }

          return result;
        },
      },
    },
  }),
);

export async function checkDatabaseConnection(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return 'disconnected';
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
