import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { getVesselOrThrow } from "../../middlewares/vesselScope.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as vesselController from "./vessel.controller.js";
import {
  assignSuperintendentSchema,
  createVesselSchema,
  updateVesselSchema,
  vesselIdParamsSchema,
} from "./vessel.schemas.js";
import { enforceVesselLimit } from "../../middlewares/planLimit.middleware.js";

export const vesselRouter = Router();

vesselRouter.use(authenticate);

vesselRouter.get(
  "/",
  requirePermission("fleet:read"),
  asyncHandler(vesselController.list),
);
vesselRouter.post(
  "/",

  requirePermission("vessels:write"),
  enforceVesselLimit,
  validate({ body: createVesselSchema }),
  asyncHandler(vesselController.create),
);

vesselRouter.use("/:id", getVesselOrThrow);
vesselRouter.get(
  "/:id",
  requirePermission("vessels:read"),
  validate({ params: vesselIdParamsSchema }),
  asyncHandler(vesselController.get),
);
vesselRouter.patch(
  "/:id",
  requirePermission("vessels:write"),
  validate({ params: vesselIdParamsSchema, body: updateVesselSchema }),
  asyncHandler(vesselController.update),
);
vesselRouter.patch(
  "/:id/superintendent",
  requirePermission("vessels:write"),
  validate({ params: vesselIdParamsSchema, body: assignSuperintendentSchema }),
  asyncHandler(vesselController.assignSuperintendent),
);
vesselRouter.delete(
  "/:id",
  requirePermission("vessels:write"),
  validate({ params: vesselIdParamsSchema }),
  asyncHandler(vesselController.remove),
);
