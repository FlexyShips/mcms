import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getTenantSettings } from '../../lib/settings.js';
import { emailQueue, notificationQueue } from '../queue.js';
import { logJobCompleted, logJobStarted } from '../job-logger.js';
import {
  logDeliveryFailure,
  publishNotification,
  sendSms,
  sendWhatsApp,
} from '../../services/notification-delivery.service.js';

const connection = { url: env.REDIS_URL };
const worker = new Worker(
  'notification',
  async (job: Job) => {
    const startedAt = logJobStarted('notification', job);
    let result: Record<string, unknown>;
    if (job.name === 'scanner') {
      await scanExpiringCertificates();
      result = { ok: true };
    } else if (
      job.name === 'vessel.certificate.expiring' ||
      job.name === 'crew.document.expiring'
    ) {
      result = await dispatchExpiry(job.data as ExpiryJob, job.name);
    } else if (
      job.name === 'vessel.superintendent.assigned' ||
      job.name === 'crew.vessel.assigned'
    ) {
      const data = job.data as { tenantId: string; recipientId: string; vesselName: string };
      const settings = await getTenantSettings(data.tenantId).catch(() => null);
      if (!settings?.moduleNotifications) result = { skipped: true };
      else {
        await publishNotification({
          id: String(job.id),
          tenantId: data.tenantId,
          recipientId: data.recipientId,
          subject: `You have been assigned to ${data.vesselName}`,
          message: `You have been assigned to ${data.vesselName}.`,
        });
        await recordLog(
          data.tenantId,
          data.recipientId,
          'IN_APP',
          `You have been assigned to ${data.vesselName}`,
        );
        result = { delivered: true };
      }
    } else result = { skipped: true };
    logJobCompleted('notification', job, startedAt, result);
    return result;
  },
  { connection, concurrency: 5 },
);

type ExpiryJob = {
  tenantId: string;
  recipientId?: string;
  email: string;
  firstName?: string;
  companyName: string;
  phone?: string | null;
  certId: string;
  vesselId?: string;
  vesselName?: string;
  certificateName: string;
  expiresAt: string;
  daysRemaining: number;
};

async function dispatchExpiry(data: ExpiryJob, name: string) {
  const settings = await getTenantSettings(data.tenantId);
  if (!settings.moduleNotifications) return { skipped: true };
  const subject =
    name === 'vessel.certificate.expiring'
      ? `Vessel certificate expiry alert: ${data.vesselName}`
      : `Crew document expiry alert: ${data.certificateName}`;
  const message = `${data.certificateName} for ${data.vesselName ?? 'the assigned record'} ${data.daysRemaining === 0 ? 'expires today' : `expires in ${data.daysRemaining} day(s)`}.`;
  if (data.recipientId) {
    await publishNotification({
      id: `${data.certId}:${data.recipientId}:${data.daysRemaining}`,
      tenantId: data.tenantId,
      recipientId: data.recipientId,
      subject,
      message,
      certificateId: data.certId,
      vesselId: data.vesselId,
      vesselName: data.vesselName,
      expiresAt: data.expiresAt,
      daysRemaining: data.daysRemaining,
    });
    await recordLog(data.tenantId, data.recipientId, 'IN_APP', subject, data.certId);
  }
  if (settings.emailNotificationsEnabled) {
    await emailQueue.add(name, data, {
      delay: settings.digestMode ? delayUntilDigest(settings.digestSendTime) : 0,
      jobId: `email-${data.certId}-${data.recipientId ?? data.email}-${data.daysRemaining}`,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    });
  }
  if (settings.smsNotificationsEnabled && data.phone)
    try {
      await sendSms(data.phone, message);
      await recordLog(data.tenantId, data.phone, 'SMS', subject, data.certId);
    } catch (error) {
      logDeliveryFailure(error, 'SMS', data.phone);
    }
  if (settings.whatsappNotificationsEnabled && data.phone)
    try {
      await sendWhatsApp(data.phone, message, data.companyName);
      await recordLog(data.tenantId, data.phone, 'WHATSAPP', subject, data.certId);
    } catch (error) {
      logDeliveryFailure(error, 'WHATSAPP', data.phone);
    }
  return { delivered: true, daysRemaining: data.daysRemaining };
}

function delayUntilDigest(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const now = new Date();
  const sendAt = new Date(now);
  sendAt.setHours(hours, minutes, 0, 0);
  return Math.max(0, sendAt.getTime() - now.getTime());
}

async function recordLog(
  tenantId: string,
  recipient: string,
  channel: string,
  subject: string,
  certificateId?: string,
) {
  await prisma.notificationLog.create({
    data: {
      tenantId,
      recipient,
      channel,
      subject,
      status: 'DELIVERED',
      sentAt: new Date(),
      certificateId,
    },
  });
}

async function scanExpiringCertificates() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, phone: true },
  });
  for (const tenant of tenants) {
    const settings = await getTenantSettings(tenant.id);

    for (const days of settings.alertDays ?? [60, 30, 14, 7]) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const start = new Date(target);
      start.setHours(0, 0, 0, 0);
      const end = new Date(target);
      end.setHours(23, 59, 59, 999);
      const certs = await prisma.certificate.findMany({
        where: {
          tenantId: tenant.id,
          expiresAt: { gte: start, lte: end },
          status: { not: 'EXPIRED' },
        },
        include: {
          vessel: {
            select: { id: true, name: true, status: true, assignedSuperintendentId: true },
          },
          crewMember: {
            select: {
              email: true,
              phone: true,
              assignments: {
                where: { isActive: true },
                select: { vessel: { select: { assignedSuperintendentId: true } } },
              },
            },
          },
        },
      });
      for (const cert of certs) {
        const superintendentIds =
          cert.crewMember?.assignments
            .map((assignment) => assignment.vessel.assignedSuperintendentId)
            .filter((id): id is string => Boolean(id)) ?? [];
        const recipientWhere = cert.vesselId
          ? {
              OR: [
                { role: 'ADMIN' as const },
                { role: 'FLEET_MANAGER' as const },
                ...(cert.vessel?.assignedSuperintendentId
                  ? [{ id: cert.vessel.assignedSuperintendentId }]
                  : []),
              ],
            }
          : {
              OR: [
                { role: 'ADMIN' as const },
                { role: 'HR_MANAGER' as const },
                ...superintendentIds.map((id) => ({ id })),
                ...(cert.crewMember?.email ? [{ email: cert.crewMember.email }] : []),
              ],
            };
        const users = await prisma.user.findMany({
          where: { tenantId: tenant.id, isActive: true, ...recipientWhere },
          select: { id: true, email: true, firstName: true },
        });
        const crewTarget =
          !cert.vesselId &&
          cert.crewMember?.email &&
          !users.some((user) => user.email === cert.crewMember?.email)
            ? [
                {
                  id: undefined,
                  email: cert.crewMember.email,
                  firstName: undefined,
                  phone: cert.crewMember.phone,
                },
              ]
            : [];
        const targets = [
          ...users.map((user) => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            phone: cert.crewMember?.email === user.email ? cert.crewMember.phone : tenant.phone,
          })),
          ...crewTarget,
          ...(settings.additionalAlertEmails?.map((email) => ({
            id: undefined,
            email,
            firstName: undefined,
            phone: tenant.phone,
          })) ?? []),
        ];
        for (const target of targets)
          await notificationQueue.add(
            cert.vesselId ? 'vessel.certificate.expiring' : 'crew.document.expiring',
            {
              tenantId: tenant.id,
              recipientId: target.id,
              email: target.email,
              firstName: target.firstName,
              companyName: tenant.name,
              phone: target.phone,
              certId: cert.id,
              vesselId: cert.vesselId ?? undefined,
              vesselName: cert.vessel?.name,
              certificateName: cert.name,
              expiresAt: cert.expiresAt.toISOString(),
              daysRemaining: days,
            },
            {
              jobId: `expiry-${cert.id}-${days}-${target.id ?? target.email}`,
              removeOnComplete: { count: 100 },
              removeOnFail: { count: 100 },
            },
          );
      }
    }

    await prisma.certificate.updateMany({
      where: {
        tenantId: tenant.id,
        expiresAt: { lt: new Date() },
        status: { notIn: ['EXPIRED', 'SUSPENDED'] },
      },
      data: { status: 'EXPIRED' },
    });
  }
}

worker.on('ready', () => logger.info('Notification BullMQ worker is ready'));
worker.on('failed', (job, err) =>
  logger.error({ err, jobName: job?.name }, 'Notification worker failed'),
);
export async function checkNotificationQueueConnection(): Promise<'connected' | 'disconnected'> {
  try {
    await worker.waitUntilReady();
    return 'connected';
  } catch {
    return 'disconnected';
  }
}
export default worker;
