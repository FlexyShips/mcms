import type { Request, Response } from "express";
import * as planService from "./plan.service.js";
import { BillingCycle } from "../../generated/prisma/enums.js";

export async function createPlan(req: Request, res: Response) {
  const plan = await planService.createPlan({
    name: req.body.name,
    description: req.body.description,
    billingCycle: req.body.billingCycle as BillingCycle,
    amountKobo: req.body.amountKobo,
    currency: req.body.currency,
    moduleFleetDashboard: req.body.modules?.fleetDashboard,
    moduleVesselManagement: req.body.modules?.vesselManagement,
    moduleCrewManagement: req.body.modules?.crewManagement,
    moduleExcelMigration: req.body.modules?.excelMigration,
    moduleDocumentRepository: req.body.modules?.documentRepository,
    moduleReporting: req.body.modules?.reporting,
    moduleRenewalWorkflow: req.body.modules?.renewalWorkflow,
    moduleNotifications: req.body.modules?.notifications,
    moduleAiFeatures: req.body.modules?.aiFeatures,
    moduleIntegrations: req.body.modules?.integrations,
    vesselLimit: req.body.vesselLimit
  });

  res.status(201).json({ plan });
}

export async function listPlans(_req: Request, res: Response) {
  const plans = await planService.listPlans();
  res.json({ plans });
}

export async function getPlan(req: Request, res: Response) {
  const plan = await planService.getPlanById(req.params.id);
  res.json({ plan });
}

export async function deletePlan(req: Request, res: Response) {
  await planService.deletePlan(req.params.id);
  res.json({ success: true });
}