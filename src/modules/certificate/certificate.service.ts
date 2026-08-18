import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

function canManageCertificates(role: string) {
  return ['ADMIN', 'FLEET_MANAGER', 'HR_MANAGER'].includes(role);
}

function certificateScopeWhere(tenantId: string, role: string, userId: string) {
  if (role === 'MARINE_SUPERINTENDENT') {
    return {
      tenantId,
      vessel: {
        assignedSuperintendentId: userId,
      },
    };
  }

  return { tenantId };
}

export async function listVesselCertificates(input: {
  tenantId: string;
  vesselId: string;
  userRole: string;
  userId: string;
}) {
  return prisma.certificate.findMany({
    where: {
      ...certificateScopeWhere(input.tenantId, input.userRole, input.userId),
      vesselId: input.vesselId,
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function getVesselCertificate(input: {
  tenantId: string;
  vesselId: string;
  certificateId: string;
  userRole: string;
  userId: string;
}) {
  const certificate = await prisma.certificate.findFirst({
    where: {
      id: input.certificateId,
      vesselId: input.vesselId,
      ...certificateScopeWhere(input.tenantId, input.userRole, input.userId),
    },
  });

  if (!certificate) {
    throw new HttpError(404, 'Certificate not found', 'CERTIFICATE_NOT_FOUND');
  }

  return certificate;
}

export async function createVesselCertificate(input: {
  tenantId: string;
  vesselId: string;
  userRole: string;
  userId: string;
  data: {
    name: string;
    category: string;
    issuingAuthority: string;
    issuedAt: Date;
    expiresAt: Date;
    notes?: string;
    status?: string;
  };
}) {
  if (!canManageCertificates(input.userRole)) {
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: input.vesselId, tenantId: input.tenantId },
    select: { id: true },
  });

  if (!vessel) {
    throw new HttpError(404, 'Vessel not found', 'VESSEL_NOT_FOUND');
  }

  return prisma.certificate.create({
    data: {
      tenantId: input.tenantId,
      vesselId: input.vesselId,
      name: input.data.name,
      category: input.data.category as never,
      issuingAuthority: input.data.issuingAuthority,
      issuedAt: input.data.issuedAt,
      expiresAt: input.data.expiresAt,
      notes: input.data.notes,
      status: (input.data.status as never) ?? 'VALID',
    },
  });
}

export async function updateVesselCertificate(input: {
  tenantId: string;
  vesselId: string;
  certificateId: string;
  userRole: string;
  userId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageCertificates(input.userRole)) {
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  }

  await getVesselCertificate({
    tenantId: input.tenantId,
    vesselId: input.vesselId,
    certificateId: input.certificateId,
    userRole: input.userRole,
    userId: input.userId,
  });

  return prisma.certificate.update({
    where: { id: input.certificateId },
    data: input.data,
  });
}

export async function deleteVesselCertificate(input: {
  tenantId: string;
  vesselId: string;
  certificateId: string;
  userRole: string;
  userId: string;
}) {
  if (!canManageCertificates(input.userRole)) {
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  }

  await getVesselCertificate({
    tenantId: input.tenantId,
    vesselId: input.vesselId,
    certificateId: input.certificateId,
    userRole: input.userRole,
    userId: input.userId,
  });

  return prisma.certificate.delete({ where: { id: input.certificateId } });
}

export async function uploadVesselCertificateFile(input: {
  tenantId: string;
  vesselId: string;
  certificateId: string;
  userRole: string;
  userId: string;
  fileUrl: string;
  fileKey: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  if (!canManageCertificates(input.userRole)) {
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  }

  await getVesselCertificate({
    tenantId: input.tenantId,
    vesselId: input.vesselId,
    certificateId: input.certificateId,
    userRole: input.userRole,
    userId: input.userId,
  });

  return prisma.certificate.update({
    where: { id: input.certificateId },
    data: {
      fileUrl: input.fileUrl,
      fileKey: input.fileKey,
      ...(input.mimeType ? { notes: input.mimeType } : {}),
      ...(input.sizeBytes ? { notes: `${input.mimeType ?? ''}:${input.sizeBytes}` } : {}),
    },
  });
}
