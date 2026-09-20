import { SubscriptionStatus, UserRole } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';
import { logTenantAudit } from '../../lib/audit.js';
import { emailQueue, notificationQueue } from '../../queues/queue.js';
import { getTenantSettings } from '../../lib/settings.js';
import { parseVesselMigrationWorkbook, type VesselMigrationRow } from './vessel-migration.js';

function canManageVessels(role: string) {
  return ['ADMIN', 'FLEET_MANAGER'].includes(role);
}

function vesselScopeWhere(tenantId: string, role: string, userId: string) {
  if (role === 'MARINE_SUPERINTENDENT') {
    return { tenantId, assignedSuperintendentId: userId };
  }

  return { tenantId };
}

export async function listVessels(tenantId: string, user: { id: string; role: string }) {
  return prisma.vessel.findMany({
    where: vesselScopeWhere(tenantId, user.role, user.id),
    orderBy: { name: 'asc' },
    include: {
      assignedSuperintendent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

export async function getVessel(tenantId: string, vesselId: string) {
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, tenantId },
    include: {
      assignedSuperintendent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!vessel) {
    throw new HttpError(404, 'Vessel not found', 'VESSEL_NOT_FOUND');
  }

  return vessel;
}

export async function createVessel(input: {
  tenantId: string;
  userRole: string;
  name: string;
  imoNumber?: string;
  vesselType: string;
  flagState: string;
  grossTonnage?: number;
  yearBuilt?: number;
  status?: string;
  assignedSuperintendentId?: string;
}) {
  if (!canManageVessels(input.userRole)) {
    throw new HttpError(403, 'Only admins and fleet managers can create vessels', 'FORBIDDEN');
  }

  if (input.assignedSuperintendentId) {
    const superintendent = await prisma.user.findFirst({
      where: {
        id: input.assignedSuperintendentId,
        tenantId: input.tenantId,
        role: UserRole.MARINE_SUPERINTENDENT,
        isActive: true,
      },
    });

    if (!superintendent) {
      throw new HttpError(404, 'Assigned superintendent not found', 'SUPERINTENDENT_NOT_FOUND');
    }
  }

  return prisma.vessel.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      imoNumber: input.imoNumber,
      vesselType: input.vesselType,
      flagState: input.flagState,
      grossTonnage: input.grossTonnage ? String(input.grossTonnage) : null,
      yearBuilt: input.yearBuilt,
      status: (input.status as never) ?? 'ACTIVE',
      assignedSuperintendentId: input.assignedSuperintendentId,
    },
  });
}

export async function updateVessel(input: {
  tenantId: string;
  vesselId: string;
  userRole: string;
  data: Record<string, unknown>;
}) {
  if (!canManageVessels(input.userRole) && input.userRole !== 'MARINE_SUPERINTENDENT') {
    throw new HttpError(403, 'You do not have access to update vessels', 'FORBIDDEN');
  }

  const vessel = await getVessel(input.tenantId, input.vesselId);

  if (input.userRole === 'MARINE_SUPERINTENDENT' && vessel.assignedSuperintendentId !== undefined) {
    throw new HttpError(403, 'You can only view your assigned vessels', 'VESSEL_SCOPE_DENIED');
  }

  return prisma.vessel.update({
    where: { id: input.vesselId },
    data: input.data,
  });
}

export async function assignSuperintendent(input: {
  tenantId: string;
  vesselId: string;
  userRole: string;
  actorUserId: string;
  ip?: string;
  superintendentId: string;
}) {
  if (!canManageVessels(input.userRole)) {
    throw new HttpError(
      403,
      'Only admins and fleet managers can assign a superintendent',
      'FORBIDDEN',
    );
  }

  const vessel = await getVessel(input.tenantId, input.vesselId);
  const superintendent = await prisma.user.findFirst({
    where: {
      id: input.superintendentId,
      tenantId: input.tenantId,
      role: UserRole.MARINE_SUPERINTENDENT,
      isActive: true,
    },
  });

  if (!superintendent) {
    throw new HttpError(404, 'Superintendent not found', 'SUPERINTENDENT_NOT_FOUND');
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { name: true },
  });
  const updatedVessel = await prisma.vessel.update({
    where: { id: vessel.id },
    data: { assignedSuperintendentId: superintendent.id },
    include: {
      assignedSuperintendent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: 'ASSIGN_SUPERINTENDENT',
    entity: 'Vessel',
    entityId: vessel.id,
    before: { assignedSuperintendentId: vessel.assignedSuperintendentId },
    after: { assignedSuperintendentId: superintendent.id },
    ip: input.ip,
  });

  const jobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  };

  await notificationQueue.add(
    'vessel.superintendent.assigned',
    {
      tenantId: input.tenantId,
      recipientId: superintendent.id,
      vesselId: vessel.id,
      vesselName: vessel.name,
    },
    jobOptions,
  );

  await emailQueue.add(
    'vessel.superintendent.assigned',
    {
      email: superintendent.email,
      firstName: superintendent.firstName,
      companyName: tenant.name,
      vesselName: vessel.name,
    },
    jobOptions,
  );

  return updatedVessel;
}

export async function migrateVessels(input: {
  tenantId: string;
  actorUserId: string;
  userRole: string;
  ip?: string;
  file: Buffer;
  originalName?: string;
}) {
  if (!canManageVessels(input.userRole)) {
    throw new HttpError(403, 'Only admins and fleet managers can migrate vessels', 'FORBIDDEN');
  }

  const rows = parseVesselMigrationWorkbook(input.file);
  const [settings, subscription, currentVesselCount] = await Promise.all([
    getTenantSettings(input.tenantId),
    prisma.subscription.findUnique({
      where: { tenantId: input.tenantId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    }),
    prisma.vessel.count({ where: { tenantId: input.tenantId, status: { not: 'DECOMMISSIONED' } } }),
  ]);

  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new HttpError(403, 'No active subscription found', 'SUBSCRIPTION_REQUIRED');
  }

  console.log({
    vesselFromDB: settings.vesselLimitOverride,
    currentSubscription: subscription.plan.vesselLimit,
    currentVesselCount,
  });
  const limit = settings.vesselLimitOverride ?? subscription.plan.vesselLimit;
  if (currentVesselCount + rows.length > limit) {
    throw new HttpError(
      403,
      `This migration would exceed your vessel limit of ${limit}`,
      'VESSEL_LIMIT_REACHED',
    );
  }

  const existingImoNumbers = rows.map((row) => row.imoNumber).filter(Boolean) as string[];
  if (existingImoNumbers.length) {
    const existing = await prisma.vessel.findMany({
      where: { tenantId: input.tenantId, imoNumber: { in: existingImoNumbers } },
      select: { imoNumber: true },
    });
    if (existing.length) {
      throw new HttpError(
        409,
        'One or more IMO numbers already exist for this tenant',
        'DUPLICATE_IMO_NUMBER',
        existing.map((vessel) => vessel.imoNumber),
      );
    }
  }

  const vessels = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of rows) {
      created.push(await tx.vessel.create({ data: vesselCreateData(input.tenantId, row) }));
    }
    return created;
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: 'MIGRATE_VESSELS',
    entity: 'Vessel',
    entityId: input.tenantId,
    after: {
      count: vessels.length,
      vesselIds: vessels.map((vessel) => vessel.id),
      fileName: input.originalName,
    },
    ip: input.ip,
  });

  return { count: vessels.length, vessels };
}

function vesselCreateData(tenantId: string, row: VesselMigrationRow) {
  return {
    tenantId,
    name: row.name,
    imoNumber: row.imoNumber,
    vesselType: row.vesselType,
    flagState: row.flagState,
    grossTonnage: row.grossTonnage === undefined ? null : String(row.grossTonnage),
    yearBuilt: row.yearBuilt,
    status: row.status,
  } as const;
}

export async function deleteVessel(tenantId: string, vesselId: string, userRole: string) {
  if (!canManageVessels(userRole)) {
    throw new HttpError(403, 'Only admins and fleet managers can delete vessels', 'FORBIDDEN');
  }

  await getVessel(tenantId, vesselId);

  return prisma.vessel.delete({ where: { id: vesselId } });
}
