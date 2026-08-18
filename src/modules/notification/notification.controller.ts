import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notificationConfigSchema, notificationTestSchema } from './notification.schemas.js';
import {
  getNotificationConfig,
  listNotificationLogs,
  sendNotificationTest,
  updateNotificationConfig,
} from './notification.service.js';
import { notificationSubscriber } from '../../lib/redis.js';

function getContext(req: Request) {
  return {
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    userId: req.user!.id,
  };
}

export const getConfig = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const data = await getNotificationConfig(getContext(req));
  return res.status(200).json({ data });
});

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

export const listLogs = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const logs = await listNotificationLogs(getContext(req));
  return res.status(200).json({ data: logs });
});

export const test = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const body = notificationTestSchema.parse(req.body);
  const result = await sendNotificationTest({ ...getContext(req), ...body });
  return res.status(200).json({ data: result });
});

export async function stream(req: Request, res: Response) {
  const tenantId = req.tenantId!;
  const recipientId = req.user!.id;
  res
    .status(200)
    .set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
  res.flushHeaders();
  res.write(': connected\n\n');
  const channel = `tenant:notifications:${tenantId}`;
  const onMessage = (_channel: string, raw: string) => {
    try {
      const event = JSON.parse(raw) as { recipientId?: string };
      if (!event.recipientId || event.recipientId === recipientId)
        res.write(`event: notification\ndata: ${raw}\n\n`);
    } catch {
      /* ignore malformed pub/sub messages */
    }
  };
  await notificationSubscriber.subscribe(channel);
  notificationSubscriber.on('message', onMessage);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    notificationSubscriber.off('message', onMessage);
    void notificationSubscriber.unsubscribe(channel);
    res.end();
  });
}
