import { HttpError } from '../utils/httpError.js';
import { prismaForTenant } from './tenantPrisma.js';

export function requireTenantId(tenantId?: string): string {
  if (!tenantId) {
    throw new HttpError(400, 'Tenant context is required', 'TENANT_REQUIRED');
  }

  return tenantId;
}

export function tenantWhere<T extends object>(tenantId: string, where?: T): T & { tenantId: string } {
  return {
    ...(where ?? {}),
    tenantId
  } as T & { tenantId: string };
}

export function tenantDb(tenantId?: string) {
  return prismaForTenant(requireTenantId(tenantId));
}
