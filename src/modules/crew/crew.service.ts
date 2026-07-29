import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";

function canManageCrew(role: string) {
  return ["ADMIN", "FLEET_MANAGER", "HR_MANAGER"].includes(role);
}

export async function listCrew(
  tenantId: string,
  user: { id: string; role: string },
) {
  const where =
    user.role === "MARINE_SUPERINTENDENT"
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
    orderBy: { createdAt: "desc" },
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
    throw new HttpError(404, "Crew member not found", "CREW_MEMBER_NOT_FOUND");
  }

  if (user.role === "MARINE_SUPERINTENDENT") {
    const hasAccess = crew.assignments.some(
      (assignment) => assignment.vessel.assignedSuperintendentId === user.id,
    );
    if (!hasAccess) {
      throw new HttpError(
        403,
        "You can only access crew on assigned vessels",
        "VESSEL_SCOPE_DENIED",
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
}) {
  if (!canManageCrew(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have permission to create crew members",
      "FORBIDDEN",
    );
  }

  return prisma.crewMember.create({
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
}

export async function updateCrew(input: {
  tenantId: string;
  crewId: string;
  userRole: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageCrew(input.userRole) && input.userRole !== "CREW_MEMBER") {
    throw new HttpError(
      403,
      "You do not have permission to update crew members",
      "FORBIDDEN",
    );
  }

  const crew = await getCrew(input.tenantId, input.crewId, {
    id: input.userId,
    role: input.userRole,
  });

  if (input.userRole === "CREW_MEMBER" && crew.id !== input.userId) {
    throw new HttpError(
      403,
      "Crew members can only update their own profile",
      "FORBIDDEN",
    );
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
  vesselId: string;
  startDate: string;
  endDate?: string;
}) {
  if (!canManageCrew(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have permission to assign crew",
      "FORBIDDEN",
    );
  }

  const crew = await prisma.crewMember.findFirst({
    where: { id: input.crewId, tenantId: input.tenantId },
  });
  const vessel = await prisma.vessel.findFirst({
    where: { id: input.vesselId, tenantId: input.tenantId },
  });

  if (!crew || !vessel) {
    throw new HttpError(
      404,
      "Crew member or vessel not found",
      "RESOURCE_NOT_FOUND",
    );
  }

  return prisma.vesselCrewAssignment.create({
    data: {
      vesselId: vessel.id,
      crewMemberId: crew.id,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      isActive: true,
    },
  });
}

export async function deleteCrew(
  tenantId: string,
  crewId: string,
  userRole: string,
) {
  if (!canManageCrew(userRole)) {
    throw new HttpError(
      403,
      "You do not have permission to delete crew members",
      "FORBIDDEN",
    );
  }

  const crew = await prisma.crewMember.findFirst({
    where: { id: crewId, tenantId },
  });
  if (!crew) {
    throw new HttpError(404, "Crew member not found", "CREW_MEMBER_NOT_FOUND");
  }

  return prisma.crewMember.delete({ where: { id: crew.id } });
}
