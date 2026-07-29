import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as webhookController from "./webhook.controller.js";

export const webhookRouter = Router();

webhookRouter.post(
  "/paystack",
  asyncHandler(webhookController.paystackWebhook),
);
