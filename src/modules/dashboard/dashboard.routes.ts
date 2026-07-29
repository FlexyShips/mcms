import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as dashboardController from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get(
  "/summary",
  requirePermission("fleet:read"),
  asyncHandler(dashboardController.summary),
);
