import { prisma } from '../../lib/prisma.js';
import { getTenantSettings } from '../../lib/settings.js';
import { deriveCertificateStatus, daysUntilExpiry } from '../../utils/certificateStatus.js';

function getAllowedVesselIds(tenantId: string, user: { id: string; role: string }) {
  if (user.role === 'MARINE_SUPERINTENDENT') {
    return prisma.vessel.findMany({
      where: { tenantId, assignedSuperintendentId: user.id },
      select: { id: true },
    });
  }

  return prisma.vessel.findMany({ where: { tenantId }, select: { id: true } });
}

export async function getDashboardSummary(tenantId: string, user: { id: string; role: string }) {
  const vessels = await getAllowedVesselIds(tenantId, user);
  const vesselIds = vessels.map((vessel) => vessel.id);

  const [totalVessels, activeVessels, certificates, renewalItems, settings, recentActivity] =
    await Promise.all([
      prisma.vessel.count({ where: { tenantId, id: { in: vesselIds } } }),
      prisma.vessel.count({
        where: { tenantId, id: { in: vesselIds }, status: 'ACTIVE' },
      }),
      prisma.certificate.findMany({
        where: { tenantId, vesselId: { in: vesselIds } },
        select: { expiresAt: true, status: true },
      }),
      prisma.renewalItem.findMany({
        where: { tenantId, vesselId: { in: vesselIds } },
        select: { stage: true },
      }),
      getTenantSettings(tenantId),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, entity: true, entityId: true, createdAt: true },
      }),
    ]);

  const asOf = new Date();
  const statuses = certificates.map((certificate) =>
    deriveCertificateStatus({
      ...certificate,
      storedStatus: certificate.status,
      expiringSoonThresholdDays: settings.expiringSoonThresholdDays,
      asOf,
    }),
  );
  const valid = statuses.filter((status) => status === 'VALID').length;
  const expiringSoon = statuses.filter((status) => status === 'EXPIRING_SOON').length;
  const expired = statuses.filter((status) => status === 'EXPIRED').length;
  const suspended = statuses.filter((status) => status === 'SUSPENDED').length;
  const underRenewal = statuses.filter((status) => status === 'UNDER_RENEWAL').length;

  const countWithin = (days: number) =>
    certificates.filter((certificate) => {
      const remaining = daysUntilExpiry(certificate.expiresAt, asOf);
      return remaining >= 0 && remaining <= days;
    }).length;

  const renewalStageBreakdown = renewalItems.reduce<Record<string, number>>((result, item) => {
    result[item.stage] = (result[item.stage] ?? 0) + 1;
    return result;
  }, {});

  const recordedCompliancePercent = certificates.length
    ? Number(((valid / certificates.length) * 100).toFixed(1))
    : 100;

  return {
    fleetCompliancePercent: recordedCompliancePercent,
    recordedCompliancePercent,
    totalVessels,
    activeVessels,
    certificateStats: {
      total: certificates.length,
      valid,
      expiringSoon,
      expired,
      suspended,
      underRenewal,
    },
    expiringByWindow: {
      within7Days: countWithin(7),
      within14Days: countWithin(14),
      within30Days: countWithin(30),
      within60Days: countWithin(60),
    },
    renewalStageBreakdown,
    recentActivity,
  };
}
