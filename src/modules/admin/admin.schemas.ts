import { z } from "zod";

export const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const tenantIdParamsSchema = z.object({
  tenantId: z.string().min(1),
});

export const tenantUserIdParamsSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
});

export const updateTenantModulesSchema = z.object({
  moduleFleetDashboard: z.boolean().optional(),
  moduleVesselManagement: z.boolean().optional(),
  moduleCrewManagement: z.boolean().optional(),
  moduleExcelMigration: z.boolean().optional(),
  moduleDocumentRepository: z.boolean().optional(),
  moduleReporting: z.boolean().optional(),
  moduleRenewalWorkflow: z.boolean().optional(),
  moduleNotifications: z.boolean().optional(),
  moduleAiFeatures: z.boolean().optional(),
  moduleIntegrations: z.boolean().optional(),
  vesselLimitOverride: z.number().int().positive().optional(),
  storageQuotaMbOverride: z.number().int().positive().optional(),
});

export const suspendTenantSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const createTenantAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const transferOwnershipSchema = z.object({
  targetUserId: z.string().min(1),
});
