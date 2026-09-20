import type { CertStatus } from '../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilExpiry(expiresAt: Date, asOf = new Date()): number {
  const expiryDay = Date.UTC(
    expiresAt.getUTCFullYear(),
    expiresAt.getUTCMonth(),
    expiresAt.getUTCDate(),
  );
  const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.round((expiryDay - asOfDay) / DAY_MS);
}

export function deriveCertificateStatus(input: {
  expiresAt: Date;
  storedStatus: CertStatus;
  expiringSoonThresholdDays: number;
  asOf?: Date;
}): CertStatus {
  const daysRemaining = daysUntilExpiry(input.expiresAt, input.asOf);

  if (input.storedStatus === 'SUSPENDED') return 'SUSPENDED';
  if (daysRemaining < 0) return 'EXPIRED';
  if (input.storedStatus === 'UNDER_RENEWAL') return 'UNDER_RENEWAL';
  if (daysRemaining <= input.expiringSoonThresholdDays) return 'EXPIRING_SOON';
  return 'VALID';
}

export function isHealthyCertificate(status: CertStatus): boolean {
  return status === 'VALID';
}
