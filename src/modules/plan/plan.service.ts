import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";
import { BillingCycle } from "../../generated/prisma/enums.js";
import { createPaystackPlan, deletePaystackPlan } from "./payment-gateway.js";

interface CreatePlanInput {
  name: string;
  description?: string;
  billingCycle: BillingCycle;
  amountKobo: number;
  currency?: string;
  moduleFleetDashboard?: boolean;
  moduleVesselManagement?: boolean;
  moduleCrewManagement?: boolean;
  moduleExcelMigration?: boolean;
  moduleDocumentRepository?: boolean;
  moduleReporting?: boolean;
  moduleRenewalWorkflow?: boolean;
  moduleNotifications?: boolean;
  moduleAiFeatures?: boolean;
  moduleIntegrations?: boolean;
  vesselLimit?: number;
}

export async function createPlan(input: CreatePlanInput) {
  const existingPlan = await prisma.plan.findUnique({
    where: { name: input.name },
  });

  if (existingPlan) {
    throw new HttpError(
      409,
      "Plan with this name already exists",
      "PLAN_EXISTS",
    );
  }

  const billingCycleMap: Record<
    BillingCycle,
    "monthly" | "annually" | "quarterly" | "biannually"
  > = {
    [BillingCycle.MONTHLY]: "monthly",
    [BillingCycle.ANNUALLY]: "annually",
    [BillingCycle.QUARTERLY]: "quarterly",
    [BillingCycle.BIANNUALLY]: "biannually",
  };

  if (!billingCycleMap[input.billingCycle]) {
    throw new HttpError(
      400,
      "Invalid billing cycle. Must be 'MONTHLY', 'ANNUALLY', 'QUARTERLY', or 'BIANNUALLY'",
      "INVALID_BILLING_CYCLE",
    );
  }

  let gatewayPlanId: string = "";
  if (input.amountKobo > 0) {
    gatewayPlanId = await createPaystackPlan({
      name: input.name,
      amount: input.amountKobo,
      currency: input.currency || "NGN",
      interval: billingCycleMap[input.billingCycle],
    });
  }

  const plan = await prisma.plan.create({
    data: {
      name: input.name,
      description: input.description,
      billingCycle: input.billingCycle,
      amountKobo: input.amountKobo,
      currency: input.currency || "NGN",
      gatewayPlanId: gatewayPlanId,
      moduleFleetDashboard: input.moduleFleetDashboard ?? true,
      moduleVesselManagement: input.moduleVesselManagement ?? true,
      moduleCrewManagement: input.moduleCrewManagement ?? true,
      moduleExcelMigration: input.moduleExcelMigration ?? true,
      moduleDocumentRepository: input.moduleDocumentRepository ?? true,
      moduleReporting: input.moduleReporting ?? true,
      moduleRenewalWorkflow: input.moduleRenewalWorkflow ?? true,
      moduleNotifications: input.moduleNotifications ?? true,
      moduleAiFeatures: input.moduleAiFeatures ?? false,
      moduleIntegrations: input.moduleIntegrations ?? false,
      vesselLimit: input.vesselLimit ?? 1,
    },
  });

  return plan;
}

export async function getPlanById(id: string) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new HttpError(404, "Plan not found", "PLAN_NOT_FOUND");
  }
  return plan;
}

export async function getPlanByName(name: string) {
  return prisma.plan.findUnique({ where: { name } });
}

export async function listPlans() {
  return prisma.plan.findMany({
    orderBy: { amountKobo: "asc" },
  });
}

export async function deletePlan(id: string) {
  const plan = await getPlanById(id);
  if (!plan) {
    throw new HttpError(
      400,
      "Invalid subscription plan",
      "INVALID_SUBSCRIPTION_PLAN",
    );
  }
  (deletePaystackPlan(plan.gatewayPlanId!),
    await prisma.plan.delete({ where: { id } }));

  return { success: true };
}
