import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { createTokenPair } from "../auth/auth.service.js";
import { PLAN_PRICING_KOBO } from "../../config/constants.js";
import { HttpError } from "../../utils/httpError.js";
import {
  BillingCycle,
  SubscriptionPlan,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "../../generated/prisma/enums.js";

const TRIAL_DAYS = 14;

type InvitePayload = {
  waitlistId: string;
  email: string;
  companyName: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function readInviteToken(token: string): Promise<InvitePayload> {
  const raw = await redis.get(`onboarding:invite:${token}`);

  if (!raw) {
    throw new HttpError(
      401,
      "Onboarding token is invalid or expired",
      "INVALID_ONBOARDING_TOKEN",
    );
  }

  return JSON.parse(raw) as InvitePayload;
}

export async function onboard(input: {
  token: string;
  companyName: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  phone?: string;
}) {
  const invite = await readInviteToken(input.token);
  const adminEmail = normalizeEmail(input.adminEmail);
  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);

  if (adminEmail !== normalizeEmail(invite.email)) {
    throw new HttpError(
      400,
      "Admin email must match the invited waitlist email",
      "INVITE_EMAIL_MISMATCH",
    );
  }

  const existingTenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ slug: input.slug }, { email: adminEmail }],
    },
  });

  if (existingTenant) {
    throw new HttpError(
      409,
      "Tenant slug or email is already in use",
      "TENANT_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  const { tenant, owner } = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findFirst({
      where: {
        name: SubscriptionPlan.STARTER,
      },
      select: {
        id: true,
      },
    });
    const createdTenant = await tx.tenant.create({
      data: {
        name: input.companyName,
        slug: input.slug,
        email: adminEmail,
        phone: input.phone,
        status: TenantStatus.TRIAL,
        trialEndsAt,
        settings: {
          create: {
            moduleAiFeatures: false,
            moduleIntegrations: false,
            lastModifiedBy: "onboarding",
          },
        },
        subscription: {
          create: {
            plan: { connect: { id: plan?.id } }, // add this

            status: SubscriptionStatus.ACTIVE,
            billingCycle: BillingCycle.MONTHLY,
            amount: (PLAN_PRICING_KOBO.STARTER.MONTHLY / 100).toFixed(2),
            currency: "NGN",
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
          },
        },
      },
    });

    const createdOwner = await tx.user.create({
      data: {
        tenantId: createdTenant.id,
        email: adminEmail,
        passwordHash,
        firstName: input.adminFirstName,
        lastName: input.adminLastName,
        role: UserRole.ADMIN,
        isOwner: true,
      },
    });

    await tx.waitlist.update({
      where: { id: invite.waitlistId },
      data: { status: "CONVERTED" },
    });

    return { tenant: createdTenant, owner: createdOwner };
  });

  await redis.del(`onboarding:invite:${input.token}`);

  const tokens = await createTokenPair(owner);

  return {
    tenant,
    user: {
      id: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      role: owner.role,
      isOwner: owner.isOwner,
    },
    tokens,
  };
}

export async function checkSlugAvailability(companySlug: string) {
  //  first you wil need to check in redis if that name is there
  const slug = await redis.get(companySlug);
  if (slug) {
  }
  //  if there meaning it has been taken
  //  if not there then you will have to go to db
  const db = await prisma.tenant.findUnique({
    where: {
      slug: companySlug,
    },
    select: {
      slug: true,
    },
  });

  //  if in db already meaning it has been taken
  if (db) {
  }
  //  if not then return is available true and then
  await redis.set(companySlug, companySlug);

  return {};
}
