import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/superAdmin.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as adminController from "./admin.controller.js";
import {
  createTenantAdminSchema,
  suspendTenantSchema,
  superAdminLoginSchema,
  tenantIdParamsSchema,
  tenantUserIdParamsSchema,
  transferOwnershipSchema,
  updateTenantModulesSchema,
} from "./admin.schemas.js";

export const adminRouter = Router();

adminRouter.post(
  "/login",
  validate({ body: superAdminLoginSchema }),
  asyncHandler(adminController.superAdminLogin),
);

adminRouter.use(requireSuperAdmin);

adminRouter.get("/tenants", asyncHandler(adminController.listTenants));
adminRouter.get(
  "/tenants/:tenantId",
  validate({ params: tenantIdParamsSchema }),
  asyncHandler(adminController.getTenant),
);
adminRouter.patch(
  "/tenants/:tenantId/modules",
  validate({ params: tenantIdParamsSchema, body: updateTenantModulesSchema }),
  asyncHandler(adminController.updateTenantModules),
);
adminRouter.patch(
  "/tenants/:tenantId/suspend",
  validate({ params: tenantIdParamsSchema, body: suspendTenantSchema }),
  asyncHandler(adminController.suspendTenant),
);
adminRouter.patch(
  "/tenants/:tenantId/reactivate",
  validate({ params: tenantIdParamsSchema }),
  asyncHandler(adminController.reactivateTenant),
);
adminRouter.get(
  "/tenants/:tenantId/users",
  validate({ params: tenantIdParamsSchema }),
  asyncHandler(adminController.listTenantUsers),
);
adminRouter.post(
  "/tenants/:tenantId/users/admin",
  validate({ params: tenantIdParamsSchema, body: createTenantAdminSchema }),
  asyncHandler(adminController.createTenantAdmin),
);
adminRouter.patch(
  "/tenants/:tenantId/transfer-ownership",
  validate({ params: tenantIdParamsSchema, body: transferOwnershipSchema }),
  asyncHandler(adminController.transferOwnership),
);
adminRouter.patch(
  "/tenants/:tenantId/users/:userId/deactivate",
  validate({ params: tenantUserIdParamsSchema }),
  asyncHandler(adminController.deactivateTenantUser),
);
adminRouter.get("/audit-logs", asyncHandler(adminController.listAuditLogs));
