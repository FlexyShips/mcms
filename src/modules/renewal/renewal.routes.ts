import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as renewalController from "./renewal.controller.js";
import {
  addCommentSchema,
  advanceStageSchema,
  createRenewalSchema,
  listRenewalsQuerySchema,
  renewalIdParamsSchema,
} from "./renewal.schemas.js";

export const renewalRouter = Router();

renewalRouter.use(authenticate);

renewalRouter.get(
  "/",
  requirePermission("renewals:read"),
  validate({ query: listRenewalsQuerySchema }),
  renewalController.list,
);
renewalRouter.post(
  "/",
  requirePermission("renewals:write"),
  validate({ body: createRenewalSchema }),
  renewalController.create,
);
renewalRouter.get(
  "/kanban",
  requirePermission("renewals:read"),
  renewalController.kanban,
);
renewalRouter.get(
  "/:id",
  requirePermission("renewals:read"),
  validate({ params: renewalIdParamsSchema }),
  renewalController.getOne,
);
renewalRouter.patch(
  "/:id/stage",
  requirePermission("renewals:write"),
  validate({ params: renewalIdParamsSchema, body: advanceStageSchema }),
  renewalController.advanceStage,
);
renewalRouter.post(
  "/:id/comments",
  requirePermission("renewals:write"),
  validate({ params: renewalIdParamsSchema, body: addCommentSchema }),
  renewalController.addComment,
);

export default renewalRouter;
