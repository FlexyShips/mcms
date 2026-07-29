import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as waitlistController from "./waitlist.controller.js";
import {
  createWaitlistSchema,
  inviteWaitlistParamsSchema,
  listWaitlistQuerySchema,
} from "./waitlist.schemas.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import { requireSuperAdmin } from "../../middlewares/superAdmin.middleware.js";

export const waitlistRouter = Router();

waitlistRouter.post(
  "/",
  validate({ body: createWaitlistSchema }),
  asyncHandler(waitlistController.create),
);

export const adminWaitlistRouter = Router();

adminWaitlistRouter.use(requireSuperAdmin);

adminWaitlistRouter.get(
  "/",

  validate({ query: listWaitlistQuerySchema }),
  asyncHandler(waitlistController.list),
);
adminWaitlistRouter.patch(
  "/:id/invite",
  validate({ params: inviteWaitlistParamsSchema }),
  asyncHandler(waitlistController.invite),
);
