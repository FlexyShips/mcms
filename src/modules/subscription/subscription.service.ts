import {
  BillingCycle,
  PaymentStatus,
  SubscriptionStatus,
  TenantStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";
import { getEndPeriod } from "../../utils/periodEnds.js";
import { paymentService } from "../payment/payment.service.js";

function periodEndFor(cycle: BillingCycle, from = new Date()): Date {
  const end = new Date(from);

  if (cycle === BillingCycle.ANNUALLY) {
    end.setFullYear(end.getFullYear() + 1);
  } else if (cycle === BillingCycle.QUARTERLY) {
    end.setMonth(end.getMonth() + 3);
  } else if (cycle === BillingCycle.BIANNUALLY) {
    end.setMonth(end.getMonth() + 6);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return end;
}

export async function getCurrentSubscription(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!subscription) {
    throw new HttpError(
      404,
      "Subscription not found",
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  return subscription;
}

export async function initiateSubscription(input: {
  tenantId: string;
  planId: string;
}) {
  const plan = await prisma.plan.findFirst({
    where: { gatewayPlanId: input.planId },
  });

  if (!plan) {
    throw new HttpError(
      400,
      "Invalid subscription plan",
      "INVALID_SUBSCRIPTION_PLAN",
    );
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
  });

  const checkoutUrlResult = await paymentService.createCheckoutSession({
    email: tenant?.email!,
    planCode: plan.gatewayPlanId!,
    amountKobo: plan.amountKobo,
    plan: plan.name,
    billingCycle: plan.billingCycle,
    companyName: tenant?.name!,
    slug: tenant?.slug!,
    provider: "paystack",
    type: "renewal",
  });
  return {
    checkoutUrl: checkoutUrlResult.checkoutUrl,
    provider: "paystack",
  };
}

// ────────────────────────────────────────────────────────────
// 2) RENEWAL — runs on every subsequent successful charge.
//    Never creates tenant/user, only extends the subscription.
// ────────────────────────────────────────────────────────────
export async function renewSubscription(paymentMetadata: {
  tenantId: string;
  paymentReference: string;
  subscriptionCode: string;
  emailToken: string;
}): Promise<{ tenantId: string; currentPeriodEnd: Date }> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: paymentMetadata.tenantId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new HttpError(
      404,
      "Subscription not found",
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  // Idempotency guard: if this exact payment reference was already applied,
  // don't extend the period twice on a webhook retry.
  const alreadyProcessed = await prisma.payment.findUnique({
    where: { reference: paymentMetadata.paymentReference },
  });
  if (alreadyProcessed) {
    return {
      tenantId: paymentMetadata.tenantId,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  const now = new Date();
  // If renewing early, extend from the current period's end rather than
  // from "now" so the customer doesn't lose the days they already paid for.
  const renewalStart =
    subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
  const newPeriodEnd = getEndPeriod(renewalStart, subscription.billingCycle);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: renewalStart,
        currentPeriodEnd: newPeriodEnd,
        paymentReference: paymentMetadata.paymentReference,
      },
    });

    await tx.payment.create({
      data: {
        reference: paymentMetadata.paymentReference,
        amount: subscription.amount,
        currency: subscription.currency,
        paidAt: now,
        subscription: {
          connect: {
            id: subscription.id!,
          },
        },
        status: PaymentStatus.SUCCESS,
        provider: "paystack",
        emailToken: paymentMetadata.emailToken,
        subscriptionCode: paymentMetadata.subscriptionCode,
      },
    });

    await tx.tenant.update({
      where: { id: paymentMetadata.tenantId },
      data: { status: TenantStatus.ACTIVE },
    });
  });

  return { tenantId: paymentMetadata.tenantId, currentPeriodEnd: newPeriodEnd };
}

// src/modules/subscription/subscription.service.ts
export async function cancelSubscription({
  tenantId,
  reason,
}: {
  tenantId: string;
  reason: string;
}): Promise<{
  status: boolean;
  message: string;
}> {
  const subscription = await getCurrentSubscription(tenantId);

  if (!subscription) {
    throw new HttpError(404, "Subscription not found");
  }

  const data =
    await paymentService.cancelSubscriptionOnPaymentGateway(tenantId);

  // Update subscription status
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelReason: reason,
    },
  });

  return data;
}
