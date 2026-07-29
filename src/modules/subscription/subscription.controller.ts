import type { Request, Response } from "express";
import { requireTenantId } from "../../lib/tenantScope.js";
import * as subscriptionService from "./subscription.service.js";

export async function current(req: Request, res: Response) {
  const subscription = await subscriptionService.getCurrentSubscription(
    requireTenantId(req.tenantId),
  );

  res.json({ subscription });
}

export async function initiate(req: Request, res: Response) {
  const result = await subscriptionService.initiateSubscription({
    tenantId: requireTenantId(req.tenantId),
    planId: req.body.planId as string,
  });

  res.status(201).json(result);
}
export async function cancelSubscription(req: Request, res: Response) {
  const result = await subscriptionService.cancelSubscription({
    tenantId: requireTenantId(req.tenantId),
    reason: req.body.reason as string,
  });

  res.status(201).json(result);
}
