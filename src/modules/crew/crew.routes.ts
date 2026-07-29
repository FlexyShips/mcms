import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as crewController from "./crew.controller.js";
import {
  assignCrewSchema,
  createCrewSchema,
  crewIdParamsSchema,
  updateCrewSchema,
} from "./crew.schemas.js";

export const crewRouter = Router();

crewRouter.use(authenticate);

crewRouter.get(
  "/",
  requirePermission("crew:read"),
  asyncHandler(crewController.list),
);
crewRouter.post(
  "/",
  requirePermission("crew:write"),
  validate({ body: createCrewSchema }),
  asyncHandler(crewController.create),
);
crewRouter.get(
  "/:id",
  requirePermission("crew:read"),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.get),
);
crewRouter.patch(
  "/:id",
  requirePermission("crew:write"),
  validate({ params: crewIdParamsSchema, body: updateCrewSchema }),
  asyncHandler(crewController.update),
);
crewRouter.post(
  "/:id/assign",
  requirePermission("crew:write"),
  validate({ params: crewIdParamsSchema, body: assignCrewSchema }),
  asyncHandler(crewController.assign),
);
crewRouter.delete(
  "/:id",
  requirePermission("crew:write"),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.remove),
);
