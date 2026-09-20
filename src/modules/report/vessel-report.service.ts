import { prisma } from '../../lib/prisma.js';
import { getTenantSettings } from '../../lib/settings.js';
import { HttpError } from '../../utils/httpError.js';
import {
  daysUntilExpiry,
  deriveCertificateStatus,
  isHealthyCertificate,
} from '../../utils/certificateStatus.js';
import type {
  ReportCertificate,
  VesselComplianceReport,
  VesselReportOptions,
} from './report.types.js';

export async function buildVesselComplianceReport(
  input: VesselReportOptions,
): Promise<VesselComplianceReport> {
  const asOf = input.asOf ?? new Date();
  const [settings, tenant, vessel] = await Promise.all([
    getTenantSettings(input.tenantId),
    prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { name: true } }),
    prisma.vessel.findFirst({
      where: {
        id: input.vesselId,
        tenantId: input.tenantId,
        ...(input.user.role === 'MARINE_SUPERINTENDENT'
          ? { assignedSuperintendentId: input.user.id }
          : {}),
      },
      include: {
        assignedSuperintendent: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        certificates: {
          include: { documents: { select: { id: true } }, renewalItem: true },
          orderBy: { expiresAt: 'asc' },
        },
        crewAssignments: {
          where: { isActive: true },
          include: {
            crewMember: {
              include: {
                certificates: {
                  include: { documents: { select: { id: true } } },
                  orderBy: { expiresAt: 'asc' },
                },
              },
            },
          },
          orderBy: { startDate: 'asc' },
        },
        renewalItems: {
          include: { certificate: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
        },
      },
    }),
  ]);

  if (!tenant || !vessel) {
    throw new HttpError(404, 'Vessel not found or outside your scope', 'VESSEL_NOT_FOUND');
  }

  const mapCertificate = (certificate: (typeof vessel.certificates)[number]): ReportCertificate => {
    const status = deriveCertificateStatus({
      expiresAt: certificate.expiresAt,
      storedStatus: certificate.status,
      expiringSoonThresholdDays: settings.expiringSoonThresholdDays,
      asOf,
    });
    return {
      id: certificate.id,
      name: certificate.name,
      category: certificate.category,
      issuingAuthority: certificate.issuingAuthority,
      issuedAt: certificate.issuedAt.toISOString(),
      expiresAt: certificate.expiresAt.toISOString(),
      daysRemaining: daysUntilExpiry(certificate.expiresAt, asOf),
      status,
      hasFile: Boolean(certificate.fileKey || certificate.documents.length),
      documentCount: certificate.documents.length,
      renewalStage: certificate.renewalItem?.stage ?? null,
    };
  };

  const certificates = vessel.certificates.map(mapCertificate);
  const countStatus = (status: ReportCertificate['status']) =>
    certificates.filter((certificate) => certificate.status === status).length;
  const valid = countStatus('VALID');
  const recordedCompliancePercent = certificates.length
    ? Number(((valid / certificates.length) * 100).toFixed(1))
    : 100;

  const crew =
    input.includeCrew === false
      ? []
      : vessel.crewAssignments.map((assignment) => {
          const statuses = assignment.crewMember.certificates.map((certificate) =>
            deriveCertificateStatus({
              expiresAt: certificate.expiresAt,
              storedStatus: certificate.status,
              expiringSoonThresholdDays: settings.expiringSoonThresholdDays,
              asOf,
            }),
          );
          const validCertificates = statuses.filter(isHealthyCertificate).length;
          return {
            id: assignment.crewMember.id,
            name: `${assignment.crewMember.firstName} ${assignment.crewMember.lastName}`,
            rank: assignment.crewMember.rank,
            assignmentStart: assignment.startDate.toISOString(),
            assignmentEnd: assignment.endDate?.toISOString() ?? null,
            totalCertificates: statuses.length,
            validCertificates,
            issues: statuses.length - validCertificates,
          };
        });

  const renewals =
    input.includeRenewals === false
      ? []
      : vessel.renewalItems.map((renewal) => ({
          id: renewal.id,
          certificateName: renewal.certificate.name,
          stage: renewal.stage,
          dueDate: renewal.dueDate.toISOString(),
          overdue: renewal.stage !== 'CLOSED' && renewal.dueDate < asOf,
          assignedTo: renewal.assignedTo,
        }));

  const actionItems: VesselComplianceReport['actionItems'] = [];
  for (const certificate of certificates) {
    if (certificate.status === 'EXPIRED' || certificate.status === 'SUSPENDED') {
      actionItems.push({
        severity: 'CRITICAL',
        code: `CERTIFICATE_${certificate.status}`,
        message: `${certificate.name} is ${certificate.status.toLowerCase().replace('_', ' ')}`,
        certificateId: certificate.id,
      });
    } else if (certificate.status === 'EXPIRING_SOON') {
      actionItems.push({
        severity: 'WARNING',
        code: 'CERTIFICATE_EXPIRING_SOON',
        message: `${certificate.name} expires in ${certificate.daysRemaining} day(s)`,
        certificateId: certificate.id,
      });
    }
    if (!certificate.hasFile) {
      actionItems.push({
        severity: 'WARNING',
        code: 'CERTIFICATE_FILE_MISSING',
        message: `${certificate.name} has no supporting file`,
        certificateId: certificate.id,
      });
    }
  }
  for (const renewal of renewals.filter((item) => item.overdue)) {
    actionItems.push({
      severity: 'CRITICAL',
      code: 'RENEWAL_OVERDUE',
      message: `Renewal for ${renewal.certificateName} is overdue`,
    });
  }

  return {
    metadata: {
      type: 'VESSEL_COMPLIANCE',
      generatedAt: new Date().toISOString(),
      asOf: asOf.toISOString(),
      tenantId: input.tenantId,
      tenantName: tenant.name,
      timezone: settings.timezone,
    },
    vessel: {
      id: vessel.id,
      name: vessel.name,
      imoNumber: vessel.imoNumber,
      vesselType: vessel.vesselType,
      flagState: vessel.flagState,
      grossTonnage: vessel.grossTonnage ? Number(vessel.grossTonnage) : null,
      yearBuilt: vessel.yearBuilt,
      status: vessel.status,
      superintendent: vessel.assignedSuperintendent
        ? {
            id: vessel.assignedSuperintendent.id,
            name: `${vessel.assignedSuperintendent.firstName} ${vessel.assignedSuperintendent.lastName}`,
            email: vessel.assignedSuperintendent.email,
          }
        : null,
    },
    summary: {
      recordedCompliancePercent,
      totalCertificates: certificates.length,
      valid,
      expiringSoon: countStatus('EXPIRING_SOON'),
      expired: countStatus('EXPIRED'),
      suspended: countStatus('SUSPENDED'),
      underRenewal: countStatus('UNDER_RENEWAL'),
      missingFiles: certificates.filter((certificate) => !certificate.hasFile).length,
      activeCrew: crew.length,
      openRenewals: renewals.filter((renewal) => renewal.stage !== 'CLOSED').length,
      overdueRenewals: renewals.filter((renewal) => renewal.overdue).length,
    },
    certificates,
    crew,
    renewals,
    actionItems,
  };
}
