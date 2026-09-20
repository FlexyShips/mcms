import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysUntilExpiry, deriveCertificateStatus } from './certificateStatus.js';

describe('certificate status calculation', () => {
  const asOf = new Date('2026-08-18T18:00:00.000Z');

  it('uses calendar days instead of partial 24-hour periods', () => {
    assert.equal(daysUntilExpiry(new Date('2026-08-19T01:00:00.000Z'), asOf), 1);
  });

  it('marks past dates as expired', () => {
    assert.equal(
      deriveCertificateStatus({
        expiresAt: new Date('2026-08-17T23:59:59.000Z'),
        storedStatus: 'VALID',
        expiringSoonThresholdDays: 30,
        asOf,
      }),
      'EXPIRED',
    );
  });

  it('marks dates inside the configured threshold as expiring soon', () => {
    assert.equal(
      deriveCertificateStatus({
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        storedStatus: 'VALID',
        expiringSoonThresholdDays: 30,
        asOf,
      }),
      'EXPIRING_SOON',
    );
  });

  it('preserves suspended and active renewal states', () => {
    assert.equal(
      deriveCertificateStatus({
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        storedStatus: 'SUSPENDED',
        expiringSoonThresholdDays: 30,
        asOf,
      }),
      'SUSPENDED',
    );
    assert.equal(
      deriveCertificateStatus({
        expiresAt: new Date('2026-08-25T00:00:00.000Z'),
        storedStatus: 'UNDER_RENEWAL',
        expiringSoonThresholdDays: 30,
        asOf,
      }),
      'UNDER_RENEWAL',
    );
  });
});
