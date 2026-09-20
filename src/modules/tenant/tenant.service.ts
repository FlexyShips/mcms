import { prisma } from '../../lib/prisma.js';
import { logTenantAudit } from '../../lib/audit.js';
import { HttpError } from '../../utils/httpError.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const profileSelect = {
  id: true,
  name: true,
  slug: true,
  email: true,
  phone: true,
  status: true,
  trialEndsAt: true,
  settings: {
    select: {
      companyLogo: true,
      companyAddress: true,
      companyWebsite: true,
      companyPhone: true,
      timezone: true,
      dateFormat: true,
      language: true,
    },
  },
} as const;

export async function getTenantProfile(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: profileSelect,
  });

  if (!tenant) {
    throw new HttpError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
  }

  return tenant;
}

export async function updateTenantProfile(input: {
  tenantId: string;
  userId: string;
  ip?: string;
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    companyLogo?: string | null;
    companyAddress?: string | null;
    companyWebsite?: string | null;
    timezone?: string;
    dateFormat?: string;
    language?: string;
  };
}) {
  const current = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { settings: true },
  });

  if (!current) {
    throw new HttpError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
  }

  const normalizedEmail = input.data.email ? normalizeEmail(input.data.email) : undefined;

  if (normalizedEmail && normalizedEmail !== current.email) {
    const emailOwner = await prisma.tenant.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (emailOwner && emailOwner.id !== input.tenantId) {
      throw new HttpError(409, 'Company email is already in use', 'TENANT_EMAIL_EXISTS');
    }
  }

  const tenantData = {
    ...(input.data.name === undefined ? {} : { name: input.data.name }),
    ...(normalizedEmail === undefined ? {} : { email: normalizedEmail }),
    ...(input.data.phone === undefined ? {} : { phone: input.data.phone }),
  };

  const settingsData = {
    ...(input.data.companyLogo === undefined ? {} : { companyLogo: input.data.companyLogo }),
    ...(input.data.companyAddress === undefined
      ? {}
      : { companyAddress: input.data.companyAddress }),
    ...(input.data.companyWebsite === undefined
      ? {}
      : { companyWebsite: input.data.companyWebsite }),
    ...(input.data.timezone === undefined ? {} : { timezone: input.data.timezone }),
    ...(input.data.dateFormat === undefined ? {} : { dateFormat: input.data.dateFormat }),
    ...(input.data.language === undefined ? {} : { language: input.data.language }),
    ...(input.data.phone === undefined ? {} : { companyPhone: input.data.phone }),
    lastModifiedBy: input.userId,
  };

  await prisma.$transaction(async (tx) => {
    if (Object.keys(tenantData).length > 0) {
      await tx.tenant.update({ where: { id: input.tenantId }, data: tenantData });
    }

    if (Object.keys(settingsData).length > 1) {
      await tx.tenantSettings.upsert({
        where: { tenantId: input.tenantId },
        update: settingsData,
        create: { tenantId: input.tenantId, ...settingsData },
      });
    }
  });

  const updated = await getTenantProfile(input.tenantId);

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: 'UPDATE_TENANT_PROFILE',
    entity: 'Tenant',
    entityId: input.tenantId,
    before: { tenant: current, settings: current.settings },
    after: updated,
    ip: input.ip,
  });

  return updated;
}
