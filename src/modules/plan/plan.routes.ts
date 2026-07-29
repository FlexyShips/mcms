import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireSuperAdmin } from "../../middlewares/superAdmin.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as planController from "./plan.controller.js";

export const planRouter = Router();

planRouter.get("/plans", asyncHandler(planController.listPlans));
planRouter.post(
  "/plans",
  requireSuperAdmin,
  asyncHandler(planController.createPlan),
);
planRouter.get(
  "/plans/:id",
  authenticate,
  asyncHandler(planController.getPlan),
);
planRouter.delete(
  "/plans/:id",
  authenticate,
  requireSuperAdmin,
  asyncHandler(planController.deletePlan),
);
