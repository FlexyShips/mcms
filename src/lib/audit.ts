import { prisma } from './prisma.js';

export async function logTenantAudit(input: {
  tenantId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ip: input.ip
    }
  });
}

export async function logSuperAdminAudit(input: {
  superAdminId: string;
  action: string;
  tenantId?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}) {
  await prisma.superAdminAuditLog.create({
    data: {
      superAdminId: input.superAdminId,
      action: input.action,
      tenantId: input.tenantId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      note: input.note
    }
  });
}
