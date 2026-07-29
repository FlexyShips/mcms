import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";

function canManageVessels(role: string) {
  return ["ADMIN", "FLEET_MANAGER"].includes(role);
}

function vesselScopeWhere(tenantId: string, role: string, userId: string) {
  if (role === "MARINE_SUPERINTENDENT") {
    return { tenantId, assignedSuperintendentId: userId };
  }

  return { tenantId };
}

export async function listVessels(
  tenantId: string,
  user: { id: string; role: string },
) {
  return prisma.vessel.findMany({
    where: vesselScopeWhere(tenantId, user.role, user.id),
    orderBy: { name: "asc" },
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
    throw new HttpError(404, "Vessel not found", "VESSEL_NOT_FOUND");
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
    throw new HttpError(
      403,
      "Only admins and fleet managers can create vessels",
      "FORBIDDEN",
    );
  }

  if (input.assignedSuperintendentId) {
    const superintendent = await prisma.user.findFirst({
      where: {
        id: input.assignedSuperintendentId,
        tenantId: input.tenantId,
        role: "MARINE_SUPERINTENDENT",
        isActive: true,
      },
    });

    if (!superintendent) {
      throw new HttpError(
        404,
        "Assigned superintendent not found",
        "SUPERINTENDENT_NOT_FOUND",
      );
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
      status: (input.status as never) ?? "ACTIVE",
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
  if (
    !canManageVessels(input.userRole) &&
    input.userRole !== "MARINE_SUPERINTENDENT"
  ) {
    throw new HttpError(
      403,
      "You do not have access to update vessels",
      "FORBIDDEN",
    );
  }

  const vessel = await getVessel(input.tenantId, input.vesselId);

  if (
    input.userRole === "MARINE_SUPERINTENDENT" &&
    vessel.assignedSuperintendentId !== undefined
  ) {
    throw new HttpError(
      403,
      "You can only view your assigned vessels",
      "VESSEL_SCOPE_DENIED",
    );
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
  superintendentId: string;
}) {
  if (!canManageVessels(input.userRole)) {
    throw new HttpError(
      403,
      "Only admins and fleet managers can assign a superintendent",
      "FORBIDDEN",
    );
  }

  const vessel = await getVessel(input.tenantId, input.vesselId);
  const superintendent = await prisma.user.findFirst({
    where: {
      id: input.superintendentId,
      tenantId: input.tenantId,
      role: "MARINE_SUPERINTENDENT",
      isActive: true,
    },
  });

  if (!superintendent) {
    throw new HttpError(
      404,
      "Superintendent not found",
      "SUPERINTENDENT_NOT_FOUND",
    );
  }

  return prisma.vessel.update({
    where: { id: vessel.id },
    data: { assignedSuperintendentId: superintendent.id },
  });
}

export async function deleteVessel(
  tenantId: string,
  vesselId: string,
  userRole: string,
) {
  if (!canManageVessels(userRole)) {
    throw new HttpError(
      403,
      "Only admins and fleet managers can delete vessels",
      "FORBIDDEN",
    );
  }

  await getVessel(tenantId, vesselId);

  return prisma.vessel.delete({ where: { id: vesselId } });
}
