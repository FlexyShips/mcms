import { PrismaPg } from "@prisma/adapter-pg";
import {
  BillingCycle,
  PrismaClient,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const superAdminPasswordHash = await bcrypt.hash("SuperAdmin123!", 12);
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await prisma.platformSettings.upsert({
    where: { id: "platform-defaults" },
    update: {},
    create: {
      id: "platform-defaults",
      lastModifiedBy: "seed",
    },
  });

  await prisma.superAdmin.upsert({
    where: { email: "platform@mcms.example" },
    update: {},
    create: {
      email: "platform@mcms.example",
      passwordHash: superAdminPasswordHash,
      firstName: "Platform",
      lastName: "Admin",
    },
  });

  // const tenant = await prisma.tenant.upsert({
  //   where: { slug: "bluetrack-maritime" },
  //   update: {},
  //   create: {
  //     name: "Bluetrack Maritime",
  //     slug: "bluetrack-maritime",
  //     email: "admin@bluetrack.example",
  //     phone: "+2348000000000",
  //     trialEndsAt,
  //     settings: {
  //       create: {
  //         moduleAiFeatures: false,
  //         moduleIntegrations: false,
  //         lastModifiedBy: "seed",
  //       },
  //     },
  //     subscription: {
  //       create: {
  //         plan: SubscriptionPlan.STARTER,
  //         status: SubscriptionStatus.ACTIVE,
  //         billingCycle: BillingCycle.MONTHLY,
  //         amount: "50000.00",
  //         currency: "NGN",
  //         currentPeriodStart: now,
  //         currentPeriodEnd: trialEndsAt,
  //       },
  //     },
  //   },
  // });

  // const owner = await prisma.user.upsert({
  //   where: {
  //     tenantId_email: {
  //       tenantId: tenant.id,
  //       email: "owner@bluetrack.example",
  //     },
  //   },
  //   update: {},
  //   create: {
  //     tenantId: tenant.id,
  //     email: "owner@bluetrack.example",
  //     passwordHash,
  //     firstName: "Ada",
  //     lastName: "Okafor",
  //     role: UserRole.ADMIN,
  //     isOwner: true,
  //   },
  // });

  // await prisma.vessel.upsert({
  //   where: { id: "seed-vessel-1" },
  //   update: {},
  //   create: {
  //     id: "seed-vessel-1",
  //     tenantId: tenant.id,
  //     name: "MV Lagos Star",
  //     imoNumber: "9876543",
  //     vesselType: "Cargo",
  //     flagState: "Nigeria",
  //     yearBuilt: 2014,
  //     assignedSuperintendentId: owner.id,
  //   },
  // });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
