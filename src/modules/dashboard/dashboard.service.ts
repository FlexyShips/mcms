import { prisma } from "../../lib/prisma.js";

function getAllowedVesselIds(
  tenantId: string,
  user: { id: string; role: string },
) {
  if (user.role === "MARINE_SUPERINTENDENT") {
    return prisma.vessel.findMany({
      where: { tenantId, assignedSuperintendentId: user.id },
      select: { id: true },
    });
  }

  return prisma.vessel.findMany({ where: { tenantId }, select: { id: true } });
}

export async function getDashboardSummary(
  tenantId: string,
  user: { id: string; role: string },
) {
  const vessels = await getAllowedVesselIds(tenantId, user);
  const vesselIds = vessels.map((vessel) => vessel.id);

  const [
    totalVessels,
    activeVessels,
    certificates,
    expiringSoon,
    expired,
    renewalItems,
  ] = await Promise.all([
    prisma.vessel.count({ where: { tenantId, id: { in: vesselIds } } }),
    prisma.vessel.count({
      where: { tenantId, id: { in: vesselIds }, status: "ACTIVE" },
    }),
    prisma.certificate.count({
      where: { tenantId, vesselId: { in: vesselIds } },
    }),
    prisma.certificate.count({
      where: { tenantId, vesselId: { in: vesselIds }, status: "EXPIRING_SOON" },
    }),
    prisma.certificate.count({
      where: { tenantId, vesselId: { in: vesselIds }, status: "EXPIRED" },
    }),
    prisma.renewalItem.count({
      where: { tenantId, vesselId: { in: vesselIds } },
    }),
  ]);

  return {
    fleetCompliancePercent:
      totalVessels > 0
        ? Number(((totalVessels - expired) / totalVessels) * 100).toFixed(1)
        : 100,
    totalVessels,
    activeVessels,
    certificateStats: {
      total: certificates,
      valid: Math.max(certificates - expiringSoon - expired, 0),
      expiringSoon,
      expired,
    },
    expiringByWindow: {
      within7Days: 0,
      within14Days: 0,
      within30Days: 0,
      within60Days: 0,
    },
    renewalStageBreakdown: {
      EXPIRY_IDENTIFIED: renewalItems,
      DOCUMENTS_REQUESTED: 0,
      SUBMITTED_TO_AUTHORITY: 0,
    },
    recentActivity: [],
  };
}
