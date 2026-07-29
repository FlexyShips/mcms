import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { emailQueue } from "../../queues/queue.js";
import { HttpError } from "../../utils/httpError.js";
import {
  BillingCycle,
  PaymentStatus,
  SignupStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import { paymentService } from "../payment/payment.service.js";
import { getEndPeriod } from "../../utils/periodEnds.js";

const SIGNUP_EXPIRATION_HOURS = 24;

const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "mcdms",
  "ene",
  "staging",
  "localhost",
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean; suggested?: string }> {
  const normalizedSlug = slug.toLowerCase();

  if (RESERVED_SLUGS.has(normalizedSlug)) {
    const suggested = `${normalizedSlug}-inc`;
    return { available: false, suggested };
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug: normalizedSlug },
  });

  if (existing) {
    const suggested = `${normalizedSlug}-inc`;
    return { available: false, suggested };
  }

  const pending = await prisma.pendingSignup.findUnique({
    where: { slug: normalizedSlug },
  });

  if (pending) {
    const suggested = `${normalizedSlug}-inc`;
    return { available: false, suggested };
  }

  return { available: true };
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function createSignup(input: {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
  slug: string;
  planId: string;
}): Promise<{ reference: string; checkoutUrl?: string; provider?: string }> {
  const email = normalizeEmail(input.email);
  const slug = input.slug.toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: { email },
  });

  if (existingUser) {
    throw new HttpError(409, "Email is already registered", "EMAIL_EXISTS");
  }

  const slugCheck = await checkSlugAvailability(slug);
  if (!slugCheck.available) {
    throw new HttpError(409, "Slug is already taken", "SLUG_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const reference = `signup_${randomBytes(16).toString("hex")}`;
  const expiresAt = addHours(new Date(), SIGNUP_EXPIRATION_HOURS);
  const plan = await prisma.plan.findFirst({
    where: { id: input.planId },
  });

  if (!plan) {
    throw new HttpError(
      400,
      "Invalid subscription plan",
      "INVALID_SUBSCRIPTION_PLAN",
    );
  }
  const signup = await prisma.pendingSignup.create({
    data: {
      email,
      passwordHash,
      fullName: input.fullName,
      companyName: input.companyName,
      slug,
      reference,
      planId: plan.id,
      cycle: plan.billingCycle,
      status: SignupStatus.PENDING,
      expiresAt,
    },
  });

  if (plan.amountKobo <= 0) {
    const trialEndsAt = addDays(new Date(), 14);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName,
          slug,
          email,
          status: TenantStatus.TRIAL,
          trialEndsAt,
          settings: {
            create: {
              moduleAiFeatures: false,
              moduleIntegrations: false,
              lastModifiedBy: "signup",
            },
          },
          subscription: {
            create: {
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              billingCycle: BillingCycle.MONTHLY,
              amount: "0",
              currency: "NGN",
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndsAt,
            },
          },
        },
      });

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName: input.fullName.split(" ")[0] ?? input.fullName,
          lastName: input.fullName.split(" ").slice(1).join(" ") ?? "",
          role: UserRole.ADMIN,
          isOwner: true,
        },
      });

      await tx.pendingSignup.update({
        where: { id: signup.id },
        data: { status: SignupStatus.ACTIVE, tenantId: tenant.id },
      });
    });

    await emailQueue.add("welcome.tenant", {
      tenantId: signup.id,
      email,
      fullName: input.fullName,
      slug,
      companyName: input.companyName,
    });

    return { reference };
  }

  const checkoutUrlResult = await paymentService.createCheckoutSession({
    email,
    planCode: plan.gatewayPlanId!,
    amountKobo: plan.amountKobo,
    plan: plan.name,
    billingCycle: plan.billingCycle,
    signupReference: reference,
    companyName: input.companyName,
    slug: input.slug,
    provider: "paystack",
    fullName: input.fullName,
    type: "signup",
  });

  await prisma.pendingSignup.update({
    where: { id: signup.id },
    data: { status: SignupStatus.AWAITING_PAYMENT },
  });

  return {
    reference,
    checkoutUrl: checkoutUrlResult.checkoutUrl,
    provider: "paystack",
  };
}

export async function getSignupStatus(reference: string): Promise<{
  status: SignupStatus;
  slug?: string;
  companyName?: string;
}> {
  const signup = await prisma.pendingSignup.findFirst({
    where: {
      reference,
    },
  });

  if (!signup) {
    throw new HttpError(404, "Signup not found", "SIGNUP_NOT_FOUND");
  }

  if (signup.expiresAt < new Date() && signup.status !== SignupStatus.ACTIVE) {
    await prisma.pendingSignup.update({
      where: { id: signup.id },
      data: { status: SignupStatus.EXPIRED },
    });
    throw new HttpError(410, "Signup has expired", "SIGNUP_EXPIRED");
  }

  return {
    status: signup.status,
    slug: signup.slug,
    companyName: signup.companyName,
  };
}

// ────────────────────────────────────────────────────────────
// 1) ONBOARDING — runs exactly once per signup, guarded by pendingSignup.status
// ────────────────────────────────────────────────────────────
export async function completeOnboarding(paymentMetadata: {
  signupReference: string;
  paymentReference: string;
  status: TenantStatus;
  subscriptionCode: string;
  emailToken: string;
}): Promise<{ tenantId: string; userId: string; slug: string }> {
  const signup = await prisma.pendingSignup.findFirst({
    where: { reference: paymentMetadata.signupReference },
    include: { plan: true },
  });

  if (!signup) {
    throw new HttpError(404, "Signup not found", "SIGNUP_NOT_FOUND");
  }

  // Idempotency: webhook retries should not re-run this. If it's already
  // ACTIVE, onboarding already happened — just return the existing tenant.
  if (signup.status === SignupStatus.ACTIVE) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: signup.slug },
      include: { users: { where: { isOwner: true } } },
    });
    if (existingTenant) {
      return {
        tenantId: existingTenant.id,
        userId: existingTenant.users[0]!.id,
        slug: existingTenant.slug,
      };
    }
  }

  if (signup.status !== SignupStatus.AWAITING_PAYMENT) {
    throw new HttpError(
      409,
      "Signup is not awaiting payment",
      "SIGNUP_NOT_AWAITING_PAYMENT",
    );
  }

  if (!signup.plan?.id) {
    throw new HttpError(
      400,
      "Signup has no plan attached",
      "SIGNUP_MISSING_PLAN",
    );
  }

  if (signup.expiresAt < new Date()) {
    throw new HttpError(410, "Signup has expired", "SIGNUP_EXPIRED");
  }

  const now = new Date();
  const billingCycle = signup.cycle ?? signup.plan.billingCycle;
  const endsAt = getEndPeriod(now, billingCycle);

  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const createdTenant = await tx.tenant.create({
      data: {
        name: signup.companyName,
        slug: signup.slug,
        email: signup.email,
        status: paymentMetadata.status,
        settings: {
          create: {
            moduleAiFeatures: signup.plan!.name !== SubscriptionPlan.STARTER,
            moduleIntegrations: signup.plan!.name !== SubscriptionPlan.STARTER,
            lastModifiedBy: "signup",
          },
        },
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        amount: String(signup.plan!.amountKobo),
        currency: "NGN",
        currentPeriodStart: now,
        currentPeriodEnd: endsAt,
        paymentReference: paymentMetadata.paymentReference,
        plan: { connect: { id: signup.plan!.id } },
        tenant: { connect: { id: createdTenant.id } },
      },
    });

    const createdUser = await tx.user.create({
      data: {
        tenantId: createdTenant.id,
        email: signup.email,
        passwordHash: signup.passwordHash,
        firstName: signup.fullName.split(" ")[0] ?? signup.fullName,
        lastName: signup.fullName.split(" ").slice(1).join(" ") ?? "",
        role: UserRole.ADMIN,
        isOwner: true,
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

    await tx.pendingSignup.update({
      where: { id: signup.id },
      data: { status: SignupStatus.ACTIVE, tenantId: createdTenant.id },
    });

    return { tenant: createdTenant, user: createdUser };
  });

  await emailQueue.add("welcome.tenant", {
    tenantId: tenant.id,
    email: signup.email,
    fullName: signup.fullName,
    slug: signup.slug,
    companyName: signup.companyName,
  });

  return { tenantId: tenant.id, userId: user.id, slug: signup.slug };
}
