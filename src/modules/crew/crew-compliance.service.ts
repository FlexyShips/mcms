import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

type Actor = { id: string; role: string };

async function getCrewForAccess(tenantId: string, crewId: string, actor: Actor) {
  const crew = await prisma.crewMember.findFirst({
    where: { id: crewId, tenantId },
    include: { assignments: { where: { isActive: true }, include: { vessel: true } } },
  });
  if (!crew) throw new HttpError(404, 'Crew member not found', 'CREW_MEMBER_NOT_FOUND');

  if (
    actor.role === 'MARINE_SUPERINTENDENT' &&
    !crew.assignments.some((a) => a.vessel.assignedSuperintendentId === actor.id)
  ) {
    throw new HttpError(403, 'You can only access crew on assigned vessels', 'VESSEL_SCOPE_DENIED');
  }
  if (actor.role === 'CREW_MEMBER') {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true } });
    if (!user || !crew.email || user.email !== crew.email) {
      throw new HttpError(403, 'You can only access your own records', 'CREW_SCOPE_DENIED');
    }
  }
  return crew;
}

function canWrite(role: string) {
  return ['ADMIN', 'FLEET_MANAGER', 'HR_MANAGER'].includes(role);
}

export async function listCrewCertificates(input: {
  tenantId: string;
  crewId: string;
  actor: Actor;
}) {
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  return prisma.certificate.findMany({
    where: { tenantId: input.tenantId, crewMemberId: input.crewId },
    include: { documents: true, renewalItem: true },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function getCrewCertificate(input: {
  tenantId: string;
  crewId: string;
  certificateId: string;
  actor: Actor;
}) {
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  const certificate = await prisma.certificate.findFirst({
    where: { id: input.certificateId, tenantId: input.tenantId, crewMemberId: input.crewId },
    include: { documents: true, renewalItem: true },
  });
  if (!certificate) throw new HttpError(404, 'Crew certificate not found', 'CERTIFICATE_NOT_FOUND');
  return certificate;
}

export async function createCrewCertificate(input: {
  tenantId: string;
  crewId: string;
  actor: Actor;
  data: Record<string, unknown>;
}) {
  if (!canWrite(input.actor.role))
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  return prisma.certificate.create({
    data: {
      tenantId: input.tenantId,
      crewMemberId: input.crewId,
      name: String(input.data.name),
      category: input.data.category as never,
      issuingAuthority: String(input.data.issuingAuthority),
      issuedAt: input.data.issuedAt as Date,
      expiresAt: input.data.expiresAt as Date,
      notes: input.data.notes as string | undefined,
      status: (input.data.status as never) ?? 'VALID',
    },
  });
}

export async function updateCrewCertificate(input: {
  tenantId: string;
  crewId: string;
  certificateId: string;
  actor: Actor;
  data: Record<string, unknown>;
}) {
  if (!canWrite(input.actor.role))
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  await getCrewCertificate(input);
  return prisma.certificate.update({ where: { id: input.certificateId }, data: input.data });
}

export async function deleteCrewCertificate(input: {
  tenantId: string;
  crewId: string;
  certificateId: string;
  actor: Actor;
}) {
  if (!canWrite(input.actor.role))
    throw new HttpError(403, 'You do not have access to manage certificates', 'FORBIDDEN');
  await getCrewCertificate(input);
  return prisma.certificate.delete({ where: { id: input.certificateId } });
}

export async function listCrewDocuments(input: { tenantId: string; crewId: string; actor: Actor }) {
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  return prisma.document.findMany({
    where: { tenantId: input.tenantId, certificate: { crewMemberId: input.crewId } },
    include: { certificate: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCrewDocument(input: {
  tenantId: string;
  crewId: string;
  actor: Actor;
  data: Record<string, unknown>;
}) {
  if (!canWrite(input.actor.role))
    throw new HttpError(403, 'You do not have access to manage documents', 'FORBIDDEN');
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  const certificate = await prisma.certificate.findFirst({
    where: {
      id: String(input.data.certificateId),
      tenantId: input.tenantId,
      crewMemberId: input.crewId,
    },
    select: { id: true },
  });
  if (!certificate) throw new HttpError(404, 'Crew certificate not found', 'CERTIFICATE_NOT_FOUND');
  return prisma.document.create({
    data: {
      tenantId: input.tenantId,
      certificateId: certificate.id,
      name: String(input.data.name),
      fileKey: String(input.data.fileKey),
      fileUrl: input.data.fileUrl as string | undefined,
      mimeType: input.data.mimeType as string | undefined,
      sizeBytes: input.data.sizeBytes as number | undefined,
      uploadedBy: input.actor.id,
      metadata: input.data.metadata as never,
    },
  });
}

export async function deleteCrewDocument(input: {
  tenantId: string;
  crewId: string;
  documentId: string;
  actor: Actor;
}) {
  if (!canWrite(input.actor.role))
    throw new HttpError(403, 'You do not have access to manage documents', 'FORBIDDEN');
  await getCrewForAccess(input.tenantId, input.crewId, input.actor);
  const document = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      tenantId: input.tenantId,
      certificate: { crewMemberId: input.crewId },
    },
    select: { id: true },
  });
  if (!document) throw new HttpError(404, 'Crew document not found', 'DOCUMENT_NOT_FOUND');
  return prisma.document.delete({ where: { id: document.id } });
}
