import { Worker, type Job } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { getTenantSettings } from "../../lib/settings.js";

const connection = { url: env.REDIS_URL };

const worker = new Worker(
  "notification",
  async (job: Job) => {
    const { name } = job;

    if (name === "scanner") {
      await scanExpiringCertificates();
      return { ok: true };
    }

    if (name === "send.vessel.cert" || name === "send.crew.doc") {
      const { tenantId, recipientId, certId, docId, daysRemaining } =
        job.data as Record<string, unknown>;
      const tenantSettings = await getTenantSettings(String(tenantId)).catch(
        () => null,
      );

      if (!tenantSettings?.moduleNotifications) {
        return { skipped: true };
      }

      await prisma.notificationLog.create({
        data: {
          tenantId: String(tenantId),
          recipient: String(recipientId),
          channel: "email",
          subject:
            name === "send.vessel.cert"
              ? "Vessel certificate expiry alert"
              : "Crew document expiry alert",
          status: "DELIVERED",
          sentAt: new Date(),
          certificateId: certId ? String(certId) : undefined,
        },
      });

      return { delivered: true, daysRemaining };
    }

    return { skipped: true };
  },
  { connection, concurrency: 5 },
);

async function scanExpiringCertificates() {
  const tenants = await prisma.tenant.findMany({ where: { status: "ACTIVE" } });

  for (const tenant of tenants) {
    const settings = await getTenantSettings(tenant.id);
    const alertDays = settings.alertDays ?? [60, 30, 14, 7];

    for (const days of alertDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const vesselCerts = await prisma.certificate.findMany({
        where: {
          tenantId: tenant.id,
          vesselId: { not: null },
          expiresAt: { gte: start, lte: end },
          status: { not: "EXPIRED" },
        },
      });

      for (const cert of vesselCerts) {
        await prisma.notificationLog.create({
          data: {
            tenantId: tenant.id,
            channel: "email",
            recipient: tenant.id,
            subject: "Certificate expiry scan",
            status: "DELIVERED",
            sentAt: new Date(),
            certificateId: cert.id,
          },
        });
      }

      const crewDocs = await prisma.certificate.findMany({
        where: {
          tenantId: tenant.id,
          crewMemberId: { not: null },
          expiresAt: { gte: start, lte: end },
          status: { not: "EXPIRED" },
        },
      });

      for (const doc of crewDocs) {
        await prisma.notificationLog.create({
          data: {
            tenantId: tenant.id,
            channel: "email",
            recipient: tenant.id,
            subject: "Crew document expiry scan",
            status: "DELIVERED",
            sentAt: new Date(),
            certificateId: doc.id,
          },
        });
      }
    }
  }
}

worker.on("ready", () => {
  logger.info("Notification BullMQ worker is ready");
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobName: job?.name }, "Notification worker failed");
});

export async function checkNotificationQueueConnection(): Promise<
  "connected" | "disconnected"
> {
  try {
    await worker.waitUntilReady();

    return "connected";
  } catch (error) {
    return "disconnected";
  }
}

export default worker;
