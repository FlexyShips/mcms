import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import type { VesselComplianceReport } from './report.types.js';

export type RenderedReport = {
  data: Buffer;
  fileName: string;
  mimeType: string;
};

function safeFileName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vessel'
  );
}

function rowsForCertificates(report: VesselComplianceReport) {
  return report.certificates.map((certificate) => ({
    Name: certificate.name,
    Category: certificate.category,
    'Issuing Authority': certificate.issuingAuthority,
    'Issued At': certificate.issuedAt,
    'Expires At': certificate.expiresAt,
    'Days Remaining': certificate.daysRemaining,
    Status: certificate.status,
    'Supporting File': certificate.hasFile ? 'Yes' : 'No',
    'Document Count': certificate.documentCount,
    'Renewal Stage': certificate.renewalStage ?? '',
  }));
}

export function renderVesselReportExcel(report: VesselComplianceReport): RenderedReport {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { Metric: 'Vessel', Value: report.vessel.name },
    { Metric: 'IMO Number', Value: report.vessel.imoNumber ?? '' },
    { Metric: 'Vessel Type', Value: report.vessel.vesselType },
    { Metric: 'Flag State', Value: report.vessel.flagState },
    { Metric: 'Status', Value: report.vessel.status },
    { Metric: 'Superintendent', Value: report.vessel.superintendent?.name ?? 'Unassigned' },
    { Metric: 'Recorded Compliance %', Value: report.summary.recordedCompliancePercent },
    { Metric: 'Total Certificates', Value: report.summary.totalCertificates },
    { Metric: 'Expired Certificates', Value: report.summary.expired },
    { Metric: 'Expiring Soon', Value: report.summary.expiringSoon },
    { Metric: 'Missing Files', Value: report.summary.missingFiles },
    { Metric: 'Active Crew', Value: report.summary.activeCrew },
    { Metric: 'Open Renewals', Value: report.summary.openRenewals },
    { Metric: 'Generated At', Value: report.metadata.generatedAt },
    { Metric: 'As Of', Value: report.metadata.asOf },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rowsForCertificates(report)),
    'Certificates',
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.crew), 'Crew');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.renewals), 'Renewals');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(report.actionItems),
    'Action Items',
  );

  return {
    data: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    fileName: `${safeFileName(report.vessel.name)}-compliance-${report.metadata.asOf.slice(0, 10)}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function renderVesselReportCsv(report: VesselComplianceReport): RenderedReport {
  const rows = rowsForCertificates(report);
  const headers = [
    'Name',
    'Category',
    'Issuing Authority',
    'Issued At',
    'Expires At',
    'Days Remaining',
    'Status',
    'Supporting File',
    'Document Count',
    'Renewal Stage',
  ];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header as keyof typeof row])).join(','),
    ),
  ];
  return {
    data: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'),
    fileName: `${safeFileName(report.vessel.name)}-certificates-${report.metadata.asOf.slice(0, 10)}.csv`,
    mimeType: 'text/csv; charset=utf-8',
  };
}

export function renderVesselReportPdf(report: VesselComplianceReport): Promise<RenderedReport> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => {
      const data = Buffer.concat(chunks);
      resolve({
        data,
        fileName: `${safeFileName(report.vessel.name)}-compliance-${report.metadata.asOf.slice(0, 10)}.pdf`,
        mimeType: 'application/pdf',
      });
    });

    const ensureSpace = (height = 50) => {
      if (document.y + height > document.page.height - 48) document.addPage();
    };
    const heading = (text: string) => {
      ensureSpace(40);
      document.moveDown(0.6).fontSize(15).fillColor('#123B5D').text(text);
      document.moveDown(0.3).fillColor('#111827');
    };
    const line = (label: string, value: unknown) => {
      ensureSpace(20);
      document.fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      document.font('Helvetica').text(String(value ?? ''));
    };

    document.fontSize(21).fillColor('#123B5D').text('Vessel Compliance Report');
    document.fontSize(12).fillColor('#374151').text(report.vessel.name);
    document.moveDown();
    line('Company', report.metadata.tenantName);
    line('IMO Number', report.vessel.imoNumber ?? 'Not recorded');
    line('Vessel Type', report.vessel.vesselType);
    line('Flag State', report.vessel.flagState);
    line('Operational Status', report.vessel.status);
    line('Superintendent', report.vessel.superintendent?.name ?? 'Unassigned');
    line('As of', report.metadata.asOf);

    heading('Compliance Summary');
    line('Recorded compliance', `${report.summary.recordedCompliancePercent}%`);
    line('Certificates', report.summary.totalCertificates);
    line('Valid', report.summary.valid);
    line('Expiring soon', report.summary.expiringSoon);
    line('Expired', report.summary.expired);
    line('Suspended', report.summary.suspended);
    line('Missing files', report.summary.missingFiles);
    line('Active crew', report.summary.activeCrew);
    line('Open renewals', report.summary.openRenewals);

    heading('Certificate Register');
    if (!report.certificates.length) document.fontSize(9).text('No certificates recorded.');
    for (const certificate of report.certificates) {
      ensureSpace(36);
      document
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(certificate.status === 'EXPIRED' ? '#B91C1C' : '#111827')
        .text(certificate.name);
      document
        .font('Helvetica')
        .fillColor('#374151')
        .text(
          `${certificate.category} | ${certificate.status} | Expires ${certificate.expiresAt.slice(0, 10)} | ${certificate.hasFile ? 'File attached' : 'File missing'}`,
        );
    }

    heading('Active Crew');
    if (!report.crew.length) document.fontSize(9).text('No active crew included.');
    for (const crewMember of report.crew) {
      ensureSpace(24);
      document
        .fontSize(9)
        .fillColor('#111827')
        .text(
          `${crewMember.name} — ${crewMember.rank} — ${crewMember.validCertificates}/${crewMember.totalCertificates} healthy certificates`,
        );
    }

    heading('Action Items');
    if (!report.actionItems.length) document.fontSize(9).text('No action items identified.');
    for (const item of report.actionItems) {
      ensureSpace(24);
      document
        .fontSize(9)
        .fillColor(item.severity === 'CRITICAL' ? '#B91C1C' : '#92400E')
        .text(`${item.severity}: ${item.message}`);
    }

    document
      .moveDown()
      .fontSize(8)
      .fillColor('#6B7280')
      .text(
        'Recorded compliance reflects the health of certificates entered in the system; it does not assert that every regulatory requirement has been recorded.',
      );
    document.end();
  });
}
