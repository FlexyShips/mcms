import { Worker, type Job } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import {
  TenantStatus,
  SubscriptionStatus,
} from "../../generated/prisma/client.js";
const connection = { url: env.REDIS_URL };
const BATCH_SIZE = 100;

const worker = new Worker(
  "tenantExpiration",
  async (job: Job) => {
    const { name } = job;

    if (name === "expire-tenants") {
      await processTrialExpirations(new Date());
      await processSubscriptionExpirations(new Date());
      return { expired: true };
    }

    return { skipped: true };
  },
  { connection, concurrency: 1 },
);

// ---------------------------------------------------------------------------
// 1. Trial expiration
// ---------------------------------------------------------------------------

async function processTrialExpirations(now: Date) {
  let suspended = 0;
  let cursor: string | undefined;

  while (true) {
    const candidates = await prisma.tenant.findMany({
      where: {
        status: TenantStatus.TRIAL,
        trialEndsAt: { lte: now },
        settings: {
          OR: [{ billingFrozen: false }],
        },
      },
      select: {
        id: true,
        email: true,
        trialEndsAt: true,
        settings: { select: { trialExtendedTo: true } },
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (candidates.length === 0) break;
    cursor = candidates[candidates.length - 1].id;

    for (const tenant of candidates) {
      // Manual extension override — skip until the extended date has also passed.
      const extendedTo = tenant.settings?.trialExtendedTo;
      if (extendedTo && extendedTo > now) continue;

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.tenant.updateMany({
          where: { id: tenant.id, status: TenantStatus.TRIAL },
          data: { status: TenantStatus.SUSPENDED },
        });

        if (updated.count === 0) return false; // already handled by another run

        await tx.notificationLog.create({
          data: {
            tenantId: tenant.id,
            channel: "EMAIL",
            recipient: tenant.email,
            subject: "Your trial has ended",
            status: "PENDING", // actual send handled by notification worker
          },
        });

        return true;
      });

      if (result) suspended++;
    }

    if (candidates.length < BATCH_SIZE) break;
  }

  return { trialsSuspended: suspended };
}

// ---------------------------------------------------------------------------
// 2. Subscription expiration (ACTIVE -> PAST_DUE -> CANCELLED)
// ---------------------------------------------------------------------------

async function processSubscriptionExpirations(now: Date) {
  const platformSettings = await prisma.platformSettings.findFirst();
  const graceDays = platformSettings?.paymentGracePeriodDays ?? 7;
  const graceMs = graceDays * 24 * 60 * 60 * 1000;

  let cancelledAtPeriodEnd = 0;
  let movedToPastDue = 0;
  let cancelledAfterGrace = 0;

  let cursor: string | undefined;

  while (true) {
    const candidates = await prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
        currentPeriodEnd: { lte: now },
        tenant: {
          settings: {
            OR: [{ billingFrozen: false }],
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        tenant: { select: { email: true } },
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (candidates.length === 0) break;
    cursor = candidates[candidates.length - 1].id;

    for (const sub of candidates) {
      const graceDeadline = new Date(sub.currentPeriodEnd.getTime() + graceMs);

      // Case A: user explicitly opted not to renew — cancel immediately at period end.
      if (sub.cancelAtPeriodEnd) {
        const didCancel = await cancelSubscriptionAndTenant(
          sub.id,
          sub.tenantId,
          "requested",
        );
        if (didCancel) cancelledAtPeriodEnd++;
        continue;
      }

      // Case B: grace period has fully elapsed with no successful renewal payment — cancel.
      if (now >= graceDeadline) {
        const paid = await hasSuccessfulRenewalPayment(
          sub.id,
          sub.currentPeriodEnd,
        );
        if (!paid) {
          const didCancel = await cancelSubscriptionAndTenant(
            sub.id,
            sub.tenantId,
            "non_payment",
          );
          if (didCancel) cancelledAfterGrace++;
        }
        continue;
      }

      // Case C: period just ended, still inside grace window — flag as PAST_DUE (idempotent).
      if (sub.status === SubscriptionStatus.ACTIVE) {
        const updated = await prisma.subscription.updateMany({
          where: { id: sub.id, status: SubscriptionStatus.ACTIVE },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        if (updated.count > 0) {
          movedToPastDue++;
          await prisma.notificationLog.create({
            data: {
              tenantId: sub.tenantId,
              channel: "EMAIL",
              recipient: sub.tenant.email,
              subject: "Payment past due",
              status: "PENDING",
            },
          });
        }
      }
    }

    if (candidates.length < BATCH_SIZE) break;
  }

  return { cancelledAtPeriodEnd, movedToPastDue, cancelledAfterGrace };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hasSuccessfulRenewalPayment(
  subscriptionId: string,
  periodEnd: Date,
) {
  const payment = await prisma.payment.findFirst({
    where: {
      subscriptionId,
      status: "SUCCESS",
      paidAt: { gte: periodEnd },
    },
    select: { id: true },
  });
  return Boolean(payment);
}

async function cancelSubscriptionAndTenant(
  subscriptionId: string,
  tenantId: string,
  reason: "requested" | "non_payment",
) {
  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.updateMany({
      where: {
        id: subscriptionId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
      },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelReason: reason,
      },
    });

    if (updatedSub.count === 0) return false; // already handled

    await tx.tenant.updateMany({
      where: {
        id: tenantId,
        status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] },
      },
      data: {
        status:
          reason === "requested"
            ? TenantStatus.CANCELLED
            : TenantStatus.SUSPENDED,
      },
    });

    return true;
  });
}

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Tenant expiry sweep failed");
});

worker.on("ready", () => {
  logger.info("Tenant expiration BullMQ worker is ready");
});

worker.on("failed", (job, err) => {
  logger.error({ err, jobName: job?.name }, "Tenant expiration worker failed");
});
