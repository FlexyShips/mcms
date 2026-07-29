import type { NextFunction, Request, Response } from "express";
import { getTenantSettings } from "../lib/settings.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";

export async function enforceVesselLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.tenantId) {
      return next(
        new HttpError(400, "Tenant context is required", "TENANT_REQUIRED"),
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: req.tenantId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return next(
        new HttpError(
          403,
          "No active subscription found",
          "SUBSCRIPTION_REQUIRED",
        ),
      );
    }

    const [settings, vesselCount] = await Promise.all([
      getTenantSettings(req.tenantId),
      prisma.vessel.count({
        where: {
          tenantId: req.tenantId,
          status: { not: "DECOMMISSIONED" },
        },
      }),
    ]);

    const limit = settings.vesselLimitOverride ?? subscription.plan.vesselLimit;

    if (vesselCount >= limit) {
      return next(
        new HttpError(
          403,
          `Your ${subscription.plan.name} plan supports up to ${limit} vessels. Please upgrade.`,
          "VESSEL_LIMIT_REACHED",
        ),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
