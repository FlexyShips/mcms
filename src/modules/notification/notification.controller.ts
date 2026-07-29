import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  notificationConfigSchema,
  notificationTestSchema,
} from "./notification.schemas.js";
import {
  getNotificationConfig,
  listNotificationLogs,
  sendNotificationTest,
  updateNotificationConfig,
} from "./notification.service.js";

function getContext(req: Request) {
  return {
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    userId: req.user!.id,
  };
}

export const getConfig = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const data = await getNotificationConfig(getContext(req));
    return res.status(200).json({ data });
  },
);

export const updateConfig = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = notificationConfigSchema.parse(req.body);
    const data = await updateNotificationConfig({
      ...getContext(req),
      data: body,
    });
    return res.status(200).json({ data });
  },
);

export const listLogs = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const logs = await listNotificationLogs(getContext(req));
    return res.status(200).json({ data: logs });
  },
);

export const test = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = notificationTestSchema.parse(req.body);
    const result = await sendNotificationTest({ ...getContext(req), ...body });
    return res.status(200).json({ data: result });
  },
);
