import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as notificationController from "./notification.controller.js";
import {
  notificationConfigSchema,
  notificationTestSchema,
} from "./notification.schemas.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get(
  "/config",
  requirePermission("settings:manage"),
  notificationController.getConfig,
);
notificationRouter.patch(
  "/config",
  requirePermission("settings:manage"),
  validate({ body: notificationConfigSchema }),
  notificationController.updateConfig,
);
notificationRouter.get(
  "/logs",
  requirePermission("settings:manage"),
  notificationController.listLogs,
);
notificationRouter.post(
  "/test",
  requirePermission("settings:manage"),
  validate({ body: notificationTestSchema }),
  notificationController.test,
);

export default notificationRouter;
