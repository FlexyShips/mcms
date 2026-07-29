import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";

const stageOrder = [
  "EXPIRY_IDENTIFIED",
  "DOCUMENTS_REQUESTED",
  "SUBMITTED_TO_AUTHORITY",
  "UNDER_SURVEY",
  "APPROVED",
  "CLOSED",
] as const;

function canManageRenewals(role: string) {
  return ["ADMIN", "FLEET_MANAGER", "HR_MANAGER"].includes(role);
}

function stageIndex(stage: string) {
  return stageOrder.indexOf(stage as (typeof stageOrder)[number]);
}

function stageScopeWhere(tenantId: string, role: string, userId: string) {
  if (role === "MARINE_SUPERINTENDENT") {
    return {
      tenantId,
      vessel: {
        assignedSuperintendentId: userId,
      },
    };
  }

  return { tenantId };
}

export async function listRenewals(input: {
  tenantId: string;
  userRole: string;
  userId: string;
  stage?: string;
  assignedTo?: string;
}) {
  return prisma.renewalItem.findMany({
    where: {
      ...stageScopeWhere(input.tenantId, input.userRole, input.userId),
      ...(input.stage ? { stage: input.stage as never } : {}),
      ...(input.assignedTo ? { assignedTo: input.assignedTo } : {}),
    },
    include: {
      certificate: true,
      vessel: true,
      history: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function getRenewal(input: {
  tenantId: string;
  renewalId: string;
  userRole: string;
  userId: string;
}) {
  const renewal = await prisma.renewalItem.findFirst({
    where: {
      id: input.renewalId,
      ...stageScopeWhere(input.tenantId, input.userRole, input.userId),
    },
    include: {
      certificate: true,
      vessel: true,
      history: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!renewal) {
    throw new HttpError(404, "Renewal item not found", "RENEWAL_NOT_FOUND");
  }

  return renewal;
}

export async function createRenewal(input: {
  tenantId: string;
  userRole: string;
  userId: string;
  certificateId: string;
  dueDate?: Date;
  assignedTo?: string;
  notes?: string;
}) {
  if (!canManageRenewals(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to manage renewals",
      "FORBIDDEN",
    );
  }

  const certificate = await prisma.certificate.findFirst({
    where: {
      id: input.certificateId,
      tenantId: input.tenantId,
    },
    select: { id: true, vesselId: true, expiresAt: true },
  });

  if (!certificate) {
    throw new HttpError(404, "Certificate not found", "CERTIFICATE_NOT_FOUND");
  }

  const existing = await prisma.renewalItem.findUnique({
    where: { certificateId: input.certificateId },
  });

  if (existing) {
    throw new HttpError(
      409,
      "A renewal item already exists for this certificate",
      "RENEWAL_EXISTS",
    );
  }

  return prisma.$transaction(async (tx) => {
    const renewal = await tx.renewalItem.create({
      data: {
        tenantId: input.tenantId,
        certificateId: input.certificateId,
        vesselId: certificate.vesselId,
        dueDate: input.dueDate ?? certificate.expiresAt,
        assignedTo: input.assignedTo,
        notes: input.notes,
      },
    });

    await tx.renewalHistory.create({
      data: {
        renewalItemId: renewal.id,
        fromStage: null,
        toStage: renewal.stage,
        changedBy: input.userId,
        comment: "Renewal item created",
      },
    });

    return renewal;
  });
}

export async function advanceRenewalStage(input: {
  tenantId: string;
  renewalId: string;
  userRole: string;
  userId: string;
  nextStage: string;
  comment?: string;
}) {
  if (!canManageRenewals(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to manage renewals",
      "FORBIDDEN",
    );
  }

  const renewal = await getRenewal({
    tenantId: input.tenantId,
    renewalId: input.renewalId,
    userRole: input.userRole,
    userId: input.userId,
  });

  const currentIndex = stageIndex(renewal.stage);
  const nextIndex = stageIndex(input.nextStage);

  if (
    currentIndex === -1 ||
    nextIndex === -1 ||
    nextIndex !== currentIndex + 1
  ) {
    throw new HttpError(
      400,
      "Invalid renewal stage transition",
      "INVALID_RENEWAL_STAGE",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.renewalItem.update({
      where: { id: input.renewalId },
      data: { stage: input.nextStage as never },
    });

    await tx.renewalHistory.create({
      data: {
        renewalItemId: input.renewalId,
        fromStage: renewal.stage,
        toStage: input.nextStage as never,
        changedBy: input.userId,
        comment: input.comment ?? "Stage advanced",
      },
    });

    if (input.nextStage === "CLOSED") {
      await tx.certificate.update({
        where: { id: renewal.certificateId },
        data: { status: "VALID" },
      });
    }

    return updated;
  });
}

export async function addRenewalComment(input: {
  tenantId: string;
  renewalId: string;
  userRole: string;
  userId: string;
  comment: string;
}) {
  if (!canManageRenewals(input.userRole)) {
    throw new HttpError(
      403,
      "You do not have access to manage renewals",
      "FORBIDDEN",
    );
  }

  await getRenewal({
    tenantId: input.tenantId,
    renewalId: input.renewalId,
    userRole: input.userRole,
    userId: input.userId,
  });

  return prisma.renewalHistory.create({
    data: {
      renewalItemId: input.renewalId,
      fromStage: null,
      toStage: "DOCUMENTS_REQUESTED",
      changedBy: input.userId,
      comment: input.comment,
    },
  });
}

export async function getRenewalKanban(input: {
  tenantId: string;
  userRole: string;
  userId: string;
}) {
  const renewals = await listRenewals({
    tenantId: input.tenantId,
    userRole: input.userRole,
    userId: input.userId,
  });

  return stageOrder.reduce(
    (acc, stage) => {
      acc[stage] = renewals.filter((renewal) => renewal.stage === stage);
      return acc;
    },
    {} as Record<string, typeof renewals>,
  );
}
