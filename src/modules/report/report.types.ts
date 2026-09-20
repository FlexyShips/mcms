import type { CertCategory, CertStatus, RenewalStage } from '../../generated/prisma/client.js';

export type VesselReportOptions = {
  tenantId: string;
  vesselId: string;
  user: { id: string; role: string };
  asOf?: Date;
  includeCrew?: boolean;
  includeRenewals?: boolean;
};

export type ReportCertificate = {
  id: string;
  name: string;
  category: CertCategory;
  issuingAuthority: string;
  issuedAt: string;
  expiresAt: string;
  daysRemaining: number;
  status: CertStatus;
  hasFile: boolean;
  documentCount: number;
  renewalStage: RenewalStage | null;
};

export type VesselComplianceReport = {
  metadata: {
    type: 'VESSEL_COMPLIANCE';
    generatedAt: string;
    asOf: string;
    tenantId: string;
    tenantName: string;
    timezone: string;
  };
  vessel: {
    id: string;
    name: string;
    imoNumber: string | null;
    vesselType: string;
    flagState: string;
    grossTonnage: number | null;
    yearBuilt: number | null;
    status: string;
    superintendent: { id: string; name: string; email: string } | null;
  };
  summary: {
    recordedCompliancePercent: number;
    totalCertificates: number;
    valid: number;
    expiringSoon: number;
    expired: number;
    suspended: number;
    underRenewal: number;
    missingFiles: number;
    activeCrew: number;
    openRenewals: number;
    overdueRenewals: number;
  };
  certificates: ReportCertificate[];
  crew: Array<{
    id: string;
    name: string;
    rank: string;
    assignmentStart: string;
    assignmentEnd: string | null;
    totalCertificates: number;
    validCertificates: number;
    issues: number;
  }>;
  renewals: Array<{
    id: string;
    certificateName: string;
    stage: RenewalStage;
    dueDate: string;
    overdue: boolean;
    assignedTo: string | null;
  }>;
  actionItems: Array<{
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    code: string;
    message: string;
    certificateId?: string;
  }>;
};
