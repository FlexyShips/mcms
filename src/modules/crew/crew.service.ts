import { UserRole } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';
import { inviteUser } from '../user/user.service.js';
import { logTenantAudit } from '../../lib/audit.js';
import { emailQueue, notificationQueue } from '../../queues/queue.js';

function canManageCrew(role: string) {
  return ['ADMIN', 'FLEET_MANAGER', 'HR_MANAGER'].includes(role);
}

export async function listCrew(tenantId: string, user: { id: string; role: string }) {
  const where =
    user.role === 'MARINE_SUPERINTENDENT'
      ? {
          tenantId,
          assignments: {
            some: {
              isActive: true,
              vessel: { assignedSuperintendentId: user.id },
            },
          },
        }
      : { tenantId };

  return prisma.crewMember.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      assignments: {
        where: { isActive: true },
        include: { vessel: true },
      },
    },
  });
}

export async function getCrew(
  tenantId: string,
  crewId: string,
  user: { id: string; role: string },
) {
  const crew = await prisma.crewMember.findFirst({
    where: { id: crewId, tenantId },
    include: {
      assignments: {
        include: { vessel: true },
      },
    },
  });

  if (!crew) {
    throw new HttpError(404, 'Crew member not found', 'CREW_MEMBER_NOT_FOUND');
  }

  if (user.role === 'MARINE_SUPERINTENDENT') {
    const hasAccess = crew.assignments.some(
      (assignment) => assignment.vessel.assignedSuperintendentId === user.id,
    );
    if (!hasAccess) {
      throw new HttpError(
        403,
        'You can only access crew on assigned vessels',
        'VESSEL_SCOPE_DENIED',
      );
    }
  }

  return crew;
}

export async function createCrew(input: {
  tenantId: string;
  userRole: string;
  firstName: string;
  lastName: string;
  rank: string;
  email?: string;
  phone?: string;
  nationality?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  actorUserId: string;
}) {
  if (!canManageCrew(input.userRole)) {
    throw new HttpError(403, 'You do not have permission to create crew members', 'FORBIDDEN');
  }

  const crew = prisma.crewMember.create({
    data: {
      tenantId: input.tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      rank: input.rank,
      email: input.email,
      phone: input.phone,
      nationality: input.nationality,
      passportNumber: input.passportNumber,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    },
  });

  inviteUser({
    tenantId: input.tenantId,
    email: input.email!,
    firstName: input.firstName,
    lastName: input.lastName,
    role: UserRole.CREW_MEMBER,
    actorUserId: input.actorUserId,
  });
  return crew;
}

export async function updateCrew(input: {
  tenantId: string;
  crewId: string;
  userRole: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageCrew(input.userRole) && input.userRole !== 'CREW_MEMBER') {
    throw new HttpError(403, 'You do not have permission to update crew members', 'FORBIDDEN');
  }

  const crew = await getCrew(input.tenantId, input.crewId, {
    id: input.userId,
    role: input.userRole,
  });

  if (input.userRole === 'CREW_MEMBER' && crew.id !== input.userId) {
    throw new HttpError(403, 'Crew members can only update their own profile', 'FORBIDDEN');
  }

  return prisma.crewMember.update({
    where: { id: crew.id },
    data: input.data,
  });
}

export async function assignCrew(input: {
  tenantId: string;
  crewId: string;
  userRole: string;
  actorUserId: string;
  ip?: string;
  vesselId: string;
  startDate: string;
  endDate?: string;
}) {
  if (!canManageCrew(input.userRole)) {
    throw new HttpError(403, 'You do not have permission to assign crew', 'FORBIDDEN');
  }

  const crew = await prisma.crewMember.findFirst({
    where: { id: input.crewId, tenantId: input.tenantId },
  });

  const vessel = await prisma.vessel.findFirst({
    where: { id: input.vesselId, tenantId: input.tenantId },
  });

  if (!crew || !vessel) {
    throw new HttpError(404, 'Crew member or vessel not found', 'RESOURCE_NOT_FOUND');
  }

  const assignment = await prisma.vesselCrewAssignment.create({
    data: {
      vesselId: vessel.id,
      crewMemberId: crew.id,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { name: true },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: 'ASSIGN_CREW_TO_VESSEL',
    entity: 'VesselCrewAssignment',
    entityId: assignment.id,
    after: {
      crewMemberId: crew.id,
      vesselId: vessel.id,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isActive: assignment.isActive,
    },
    ip: input.ip,
  });

  const jobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  };

  await notificationQueue.add(
    'crew.vessel.assigned',
    {
      tenantId: input.tenantId,
      recipientId: crew.id,
      crewMemberId: crew.id,
      vesselId: vessel.id,
      vesselName: vessel.name,
    },
    jobOptions,
  );

  if (crew.email) {
    await emailQueue.add(
      'crew.vessel.assigned',
      {
        email: crew.email,
        firstName: crew.firstName,
        companyName: tenant.name,
        vesselName: vessel.name,
        startDate: assignment.startDate.toISOString(),
        endDate: assignment.endDate?.toISOString(),
      },
      jobOptions,
    );
  }

  return assignment;
}

export async function deleteCrew(tenantId: string, crewId: string, userRole: string) {
  if (!canManageCrew(userRole)) {
    throw new HttpError(403, 'You do not have permission to delete crew members', 'FORBIDDEN');
  }

  const crew = await prisma.crewMember.findFirst({
    where: { id: crewId, tenantId },
  });
  if (!crew) {
    throw new HttpError(404, 'Crew member not found', 'CREW_MEMBER_NOT_FOUND');
  }

  return prisma.crewMember.delete({ where: { id: crew.id } });
}
