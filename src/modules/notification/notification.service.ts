import { prisma } from '../../lib/prisma.js';
import { getTenantSettings, invalidateTenantSettingsCache } from '../../lib/settings.js';
import { HttpError } from '../../utils/httpError.js';
import {
  publishNotification,
  sendSms,
  sendWhatsApp,
} from '../../services/notification-delivery.service.js';
import { sendNotificationTestEmail } from '../../services/email.service.js';

function canManageNotifications(role: string) {
  return ['ADMIN', 'FLEET_MANAGER'].includes(role);
}

export async function getNotificationConfig(input: { tenantId: string; userRole: string }) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(403, 'You do not have access to notification settings', 'FORBIDDEN');
  }

  const {
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    whatsappNotificationsEnabled,
    alertDays,
    digestMode,
    digestSendTime,
    additionalAlertEmails,
  } = await getTenantSettings(input.tenantId);

  return {
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    whatsappNotificationsEnabled,
    alertDays,
    digestMode,
    digestSendTime,
    additionalAlertEmails,
  };
}

export async function updateNotificationConfig(input: {
  tenantId: string;
  userRole: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(403, 'You do not have access to notification settings', 'FORBIDDEN');
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
  const {
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    whatsappNotificationsEnabled,
    alertDays,
    digestMode,
    digestSendTime,
    additionalAlertEmails,
  } = settings;
  return {
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    whatsappNotificationsEnabled,
    alertDays,
    digestMode,
    digestSendTime,
    additionalAlertEmails,
  };
}

export async function listNotificationLogs(input: { tenantId: string; userRole: string }) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(403, 'You do not have access to notification logs', 'FORBIDDEN');
  }

  return prisma.notificationLog.findMany({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function sendNotificationTest(input: {
  tenantId: string;
  userRole: string;
  userId: string;
  recipient?: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'in_app';
}) {
  if (!canManageNotifications(input.userRole)) {
    throw new HttpError(403, 'You do not have access to notification settings', 'FORBIDDEN');
  }

  const settings = await getTenantSettings(input.tenantId);
  if (!settings.moduleNotifications) {
    throw new HttpError(
      409,
      'Notifications are disabled for this tenant',
      'NOTIFICATIONS_DISABLED',
    );
  }

  if (input.channel === 'email' && !settings.emailNotificationsEnabled) {
    throw new HttpError(
      409,
      'Email notifications are disabled for this tenant',
      'EMAIL_NOTIFICATIONS_DISABLED',
    );
  }
  if (input.channel === 'sms' && !settings.smsNotificationsEnabled) {
    throw new HttpError(
      409,
      'SMS notifications are disabled for this tenant',
      'SMS_NOTIFICATIONS_DISABLED',
    );
  }
  if (input.channel === 'whatsapp' && !settings.whatsappNotificationsEnabled) {
    throw new HttpError(
      409,
      'WhatsApp notifications are disabled for this tenant',
      'WHATSAPP_NOTIFICATIONS_DISABLED',
    );
  }

  const recipient = input.channel === 'in_app' ? input.userId : input.recipient;
  if (!recipient) {
    throw new HttpError(
      400,
      `A recipient is required for ${input.channel} tests`,
      'TEST_RECIPIENT_REQUIRED',
    );
  }

  const channel = input.channel.toUpperCase();
  const subject = 'MCDMS notification test';
  const message =
    'This is a test notification. Your notification configuration is working correctly.';
  const log = await prisma.notificationLog.create({
    data: {
      tenantId: input.tenantId,
      channel,
      recipient,
      subject,
      status: 'PENDING',
    },
  });

  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: input.tenantId },
      select: { name: true },
    });
    if (input.channel === 'email') {
      if (!recipient.includes('@'))
        throw new HttpError(
          400,
          'A valid email address is required for email tests',
          'INVALID_TEST_RECIPIENT',
        );
      await sendNotificationTestEmail({ email: recipient, companyName: tenant.name });
    } else if (input.channel === 'sms') {
      await sendSms(recipient, message);
    } else if (input.channel === 'whatsapp') {
      await sendWhatsApp(recipient, message, tenant.name);
    } else {
      await publishNotification({
        id: log.id,
        tenantId: input.tenantId,
        recipientId: input.userId,
        subject,
        message,
      });
    }

    const deliveredLog = await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'DELIVERED', sentAt: new Date() },
    });
    return { log: deliveredLog, message: 'Test notification sent successfully' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Notification delivery failed';
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMsg },
    });
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      `Unable to send ${input.channel} test notification`,
      'NOTIFICATION_DELIVERY_FAILED',
    );
  }
}
