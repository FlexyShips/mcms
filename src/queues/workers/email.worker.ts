import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  sendSignupPayment,
  sendTenantWelcome,
  sendWaitlistAcknowledgement,
  sendWaitlistLaunchAnnouncement,
} from '../../services/email.service.js';
import { logJobCompleted, logJobStarted } from '../job-logger.js';
import { prisma } from '../../lib/prisma.js';

const worker = new Worker(
  'email',
  async (job: Job) => {
    const startedAt = logJobStarted('email', job);
    let result: Record<string, unknown>;

    if (job.name === 'welcome.tenant') {
      await sendTenantWelcome(
        job.data as {
          email: string;
          fullName: string;
          companyName: string;
          url: string;
        },
      );

      result = { sent: true };
    } else if (job.name === 'signup.payment') {
      await sendSignupPayment(
        job.data as {
          email: string;
          fullName: string;
          companyName: string;
          checkoutUrl: string;
        },
      );

      result = { sent: true };
    } else if (job.name === 'waitlist.acknowledgement') {
      await sendWaitlistAcknowledgement(
        job.data as {
          email: string;
          name: string;
          companyName: string;
        },
      );

      result = { sent: true };
    } else if (job.name === 'waitlist.product-launch') {
      await sendWaitlistLaunchAnnouncement(
        job.data as {
          email: string;
          name: string;
          companyName: string;
        },
      );

      await prisma.waitlist.update({
        where: { email: (job.data as { email: string }).email },
        data: { status: 'INVITED', invitedAt: new Date() },
      });
      result = {
        sent: true,
        campaignId: (job.data as { campaignId?: string }).campaignId,
      };
    } else {
      result = { skipped: true };
    }

    logJobCompleted('email', job, startedAt, result);
    return result;
  },
  { connection: { url: env.REDIS_URL }, concurrency: 10 },
);

worker.on('ready', () => {
  logger.info('Email BullMQ worker is ready');
});

worker.on('failed', (job, err) => {
  logger.error({ err, jobName: job?.name }, 'Email worker failed');
});

export default worker;
