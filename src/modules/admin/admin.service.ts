import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { logSuperAdminAudit } from "../../lib/audit.js";
import { signSuperAdminAccessToken } from "../auth/jwt.service.js";
import { HttpError } from "../../utils/httpError.js";
import { TenantStatus, UserRole } from "../../generated/prisma/enums.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginSuperAdmin(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });

  if (!superAdmin || !superAdmin.isActive) {
    throw new HttpError(
      401,
      "Invalid super admin credentials",
      "SUPER_ADMIN_INVALID_CREDENTIALS",
    );
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    superAdmin.passwordHash,
  );

  if (!passwordMatches) {
    throw new HttpError(
      401,
      "Invalid super admin credentials",
      "SUPER_ADMIN_INVALID_CREDENTIALS",
    );
  }

  await prisma.superAdmin.update({
    where: { id: superAdmin.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signSuperAdminAccessToken({ sub: superAdmin.id });

  return {
    superAdmin: {
      id: superAdmin.id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
    },
    accessToken,
  };
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      settings: true,
      _count: { select: { users: true, vessels: true } },
    },
  });
}

export async function getTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      settings: true,
      _count: { select: { users: true, vessels: true } },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found", "TENANT_NOT_FOUND");
  }

  return tenant;
}

export async function updateTenantModules(input: {
  tenantId: string;
  superAdminId: string;
  data: Record<string, boolean | number | null | undefined>;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { settings: true },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found", "TENANT_NOT_FOUND");
  }

  const settings = tenant.settings ?? { id: undefined };
  const updates = Object.fromEntries(
    Object.entries(input.data).filter(([, value]) => value !== undefined),
  );

  const updatedSettings = await prisma.tenantSettings.upsert({
    where: { tenantId: input.tenantId },
    update: updates,
    create: {
      tenantId: input.tenantId,
      ...updates,
    },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "UPDATE_TENANT_MODULES",
    tenantId: input.tenantId,
    before: tenant.settings ?? {},
    after: updatedSettings,
  });

  return updatedSettings;
}

export async function suspendTenant(input: {
  tenantId: string;
  superAdminId: string;
  reason?: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found", "TENANT_NOT_FOUND");
  }

  const updated = await prisma.tenant.update({
    where: { id: input.tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "SUSPEND_TENANT",
    tenantId: input.tenantId,
    before: { status: tenant.status },
    after: { status: updated.status, reason: input.reason },
    note: input.reason,
  });

  return updated;
}

export async function reactivateTenant(input: {
  tenantId: string;
  superAdminId: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found", "TENANT_NOT_FOUND");
  }

  const updated = await prisma.tenant.update({
    where: { id: input.tenantId },
    data: { status: TenantStatus.ACTIVE },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "REACTIVATE_TENANT",
    tenantId: input.tenantId,
    before: { status: tenant.status },
    after: { status: updated.status },
  });

  return updated;
}

export async function listTenantUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isOwner: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
}

export async function createTenantAdmin(input: {
  tenantId: string;
  superAdminId: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findFirst({
    where: { tenantId: input.tenantId, email },
  });

  if (existing) {
    throw new HttpError(
      409,
      "A user with this email already exists for the tenant",
      "TENANT_USER_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const created = await prisma.user.create({
    data: {
      tenantId: input.tenantId,
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: UserRole.ADMIN,
      isOwner: false,
      isActive: true,
    },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "CREATE_TENANT_ADMIN",
    tenantId: input.tenantId,
    after: { userId: created.id, email: created.email, role: created.role },
  });

  return created;
}

export async function transferOwnership(input: {
  tenantId: string;
  superAdminId: string;
  targetUserId: string;
}) {
  const target = await prisma.user.findFirst({
    where: { id: input.targetUserId, tenantId: input.tenantId },
  });

  if (!target) {
    throw new HttpError(404, "Target user not found", "USER_NOT_FOUND");
  }

  if (!target.isActive) {
    throw new HttpError(400, "Target user must be active", "USER_INACTIVE");
  }

  await prisma.user.updateMany({
    where: { tenantId: input.tenantId, isOwner: true },
    data: { isOwner: false },
  });

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isOwner: true, role: UserRole.ADMIN },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "TRANSFER_TENANT_OWNERSHIP",
    tenantId: input.tenantId,
    before: { userId: target.id, isOwner: false },
    after: { userId: updated.id, isOwner: true, role: updated.role },
  });

  return updated;
}

export async function deactivateTenantUser(input: {
  tenantId: string;
  superAdminId: string;
  userId: string;
}) {
  const target = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
  });

  if (!target) {
    throw new HttpError(404, "Target user not found", "USER_NOT_FOUND");
  }

  if (target.isOwner) {
    throw new HttpError(
      403,
      "The tenant owner cannot be deactivated by the super admin",
      "OWNER_DEACTIVATION_DENIED",
    );
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  await logSuperAdminAudit({
    superAdminId: input.superAdminId,
    action: "DEACTIVATE_TENANT_USER",
    tenantId: input.tenantId,
    before: { isActive: target.isActive },
    after: { isActive: updated.isActive },
  });

  return updated;
}

export async function listSuperAdminAuditLogs() {
  return prisma.superAdminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
