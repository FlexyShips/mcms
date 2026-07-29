import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireTenantAdmin } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as subscriptionController from "./subscription.controller.js";
import {
  cancelSubscriptionSchema,
  initiateSubscriptionSchema,
} from "./subscription.schemas.js";

export const subscriptionRouter = Router();

subscriptionRouter.get(
  "/current",
  authenticate,
  asyncHandler(subscriptionController.current),
);
subscriptionRouter.post(
  "/initiate",
  authenticate,
  requireTenantAdmin,
  validate({ body: initiateSubscriptionSchema }),
  asyncHandler(subscriptionController.initiate),
);
subscriptionRouter.post(
  "/cancel",
  authenticate,
  requireTenantAdmin,
  validate({ body: cancelSubscriptionSchema }),
  asyncHandler(subscriptionController.cancelSubscription),
);
