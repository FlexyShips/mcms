import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderVesselReportCsv,
  renderVesselReportExcel,
  renderVesselReportPdf,
} from './report.renderer.js';
import type { VesselComplianceReport } from './report.types.js';

const report: VesselComplianceReport = {
  metadata: {
    type: 'VESSEL_COMPLIANCE',
    generatedAt: '2026-08-18T12:00:00.000Z',
    asOf: '2026-08-18T00:00:00.000Z',
    tenantId: 'tenant-1',
    tenantName: 'Blue Track',
    timezone: 'Africa/Lagos',
  },
  vessel: {
    id: 'vessel-1',
    name: 'MV Reliable',
    imoNumber: '1234567',
    vesselType: 'Cargo',
    flagState: 'Nigeria',
    grossTonnage: 1000,
    yearBuilt: 2020,
    status: 'ACTIVE',
    superintendent: null,
  },
  summary: {
    recordedCompliancePercent: 100,
    totalCertificates: 1,
    valid: 1,
    expiringSoon: 0,
    expired: 0,
    suspended: 0,
    underRenewal: 0,
    missingFiles: 0,
    activeCrew: 0,
    openRenewals: 0,
    overdueRenewals: 0,
  },
  certificates: [
    {
      id: 'certificate-1',
      name: 'Safety Certificate',
      category: 'STATUTORY',
      issuingAuthority: 'Authority',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      daysRemaining: 136,
      status: 'VALID',
      hasFile: true,
      documentCount: 1,
      renewalStage: null,
    },
  ],
  crew: [],
  renewals: [],
  actionItems: [],
};

describe('vessel report renderers', () => {
  it('creates an Excel workbook', () => {
    const rendered = renderVesselReportExcel(report);
    assert.equal(rendered.data.subarray(0, 2).toString(), 'PK');
    assert.match(rendered.fileName, /\.xlsx$/);
  });

  it('creates a certificate CSV', () => {
    const rendered = renderVesselReportCsv(report);
    assert.match(rendered.data.toString('utf8'), /Safety Certificate/);
    assert.match(rendered.fileName, /\.csv$/);
  });

  it('creates a PDF document', async () => {
    const rendered = await renderVesselReportPdf(report);
    assert.equal(rendered.data.subarray(0, 4).toString(), '%PDF');
    assert.match(rendered.fileName, /\.pdf$/);
  });
});
