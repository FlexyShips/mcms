import { prisma } from "../../lib/prisma.js";
import {
  getTenantSettings,
  invalidateTenantSettingsCache,
} from "../../lib/settings.js";
import { HttpError } from "../../utils/httpError.js";

function canManageNotifications(role: string) {
  return ["ADMIN", "FLEET_MANAGER"].includes(role);
}

export async function getNotificationConfig(input: {
  tenantId: string;
  userRole: string;
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to notification settings",
      "FORBIDDEN",
    );
  }

  return getTenantSettings(input.tenantId);
}

export async function updateNotificationConfig(input: {
  tenantId: string;
  userRole: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to notification settings",
      "FORBIDDEN",
    );
  }

  const settings = await prisma.tenantSettings.update({
    where: { tenantId: input.tenantId },
    data: {
      ...input.data,
      lastModifiedBy: input.userId,
      lastModifiedAt: new Date(),
    },
  });

  await invalidateTenantSettingsCache(input.tenantId);
  return settings;
}

export async function listNotificationLogs(input: {
  tenantId: string;
  userRole: string;
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to notification logs",
      "FORBIDDEN",
    );
  }

  return prisma.notificationLog.findMany({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function sendNotificationTest(input: {
  tenantId: string;
  userRole: string;
  recipient: string;
  channel?: string;
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to notification settings",
      "FORBIDDEN",
    );
  }

  const log = await prisma.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      channel: input.channel ?? "email",
      recipient: input.recipient,
      subject: "MCDMS notification test",
      status: "DELIVERED",
      sentAt: new Date(),
    },
  });

  return { log, message: "Test notification recorded" };
}
