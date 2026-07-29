import type { NextFunction, Request, Response } from "express";
import type { TenantSettings } from "../generated/prisma/client.js";
import { getTenantSettings } from "../lib/settings.js";
import { HttpError } from "../utils/httpError.js";

export type TenantModule =
  | "fleetDashboard"
  | "vesselManagement"
  | "crewManagement"
  | "excelMigration"
  | "documentRepository"
  | "reporting"
  | "renewalWorkflow"
  | "notifications"
  | "aiFeatures"
  | "integrations";

const moduleToSettingKey: Record<TenantModule, keyof TenantSettings> = {
  fleetDashboard: "moduleFleetDashboard",
  vesselManagement: "moduleVesselManagement",
  crewManagement: "moduleCrewManagement",
  excelMigration: "moduleExcelMigration",
  documentRepository: "moduleDocumentRepository",
  reporting: "moduleReporting",
  renewalWorkflow: "moduleRenewalWorkflow",
  notifications: "moduleNotifications",
  aiFeatures: "moduleAiFeatures",
  integrations: "moduleIntegrations",
};

export function requireModule(moduleName: TenantModule) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.tenantId) {
        return next(
          new HttpError(400, "Tenant context is required", "TENANT_REQUIRED"),
        );
      }

      const settings = await getTenantSettings(req.tenantId);
      const settingKey = moduleToSettingKey[moduleName];

      if (!settings[settingKey]) {
        return next(
          new HttpError(
            403,
            `Module is not enabled: ${moduleName}`,
            "MODULE_DISABLED",
          ),
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
