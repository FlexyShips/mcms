import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  sendSignupPayment,
  sendCrewVesselAssignment,
  sendVesselSuperintendentAssignment,
  sendTenantWelcome,
  sendUserInvite,
  sendWaitlistAcknowledgement,
  sendWaitlistLaunchAnnouncement,
  sendVesselCertificateExpiry,
  sendCrewDocumentExpiry,
} from '../../services/email.service.js';
import { logJobCompleted, logJobStarted } from '../job-logger.js';
import { prisma } from '../../lib/prisma.js';

const worker = new Worker(
  'email',
  async (job: Job) => {
    const startedAt = logJobStarted('email', job);
    let result: Record<string, unknown>;

    if (job.name === 'user.invite') {
      await sendUserInvite(
        job.data as {
          email: string;
          firstName: string;
          companyName: string;
          role: 'ADMIN' | 'FLEET_MANAGER' | 'MARINE_SUPERINTENDENT' | 'HR_MANAGER' | 'CREW_MEMBER';
          inviteUrl: string;
        },
      );

      result = { sent: true };
    } else if (job.name === 'vessel.superintendent.assigned') {
      await sendVesselSuperintendentAssignment(
        job.data as {
          email: string;
          firstName: string;
          companyName: string;
          vesselName: string;
        },
      );
      result = { sent: true };
    } else if (job.name === 'crew.vessel.assigned') {
      await sendCrewVesselAssignment(
        job.data as {
          email: string;
          firstName: string;
          companyName: string;
          vesselName: string;
          startDate: string;
          endDate?: string;
        },
      );
      result = { sent: true };
    } else if (job.name === 'welcome.tenant') {
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
    } else if (job.name === 'vessel.certificate.expiring') {
      await sendVesselCertificateExpiry(
        job.data as Parameters<typeof sendVesselCertificateExpiry>[0],
      );
      result = { sent: true };
    } else if (job.name === 'crew.document.expiring') {
      await sendCrewDocumentExpiry(job.data as Parameters<typeof sendCrewDocumentExpiry>[0]);
      result = { sent: true };
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
