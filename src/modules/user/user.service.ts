import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { logTenantAudit } from "../../lib/audit.js";
import { HttpError } from "../../utils/httpError.js";
import { UserRole } from "../../generated/prisma/enums.js";

const USER_INVITE_TTL_SECONDS = 48 * 60 * 60;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makeInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

async function countActiveAdmins(tenantId: string): Promise<number> {
  return prisma.user.count({
    where: {
      tenantId,
      role: "ADMIN",
      isActive: true,
    },
  });
}

async function getTenantUserOrThrow(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!user) {
    throw new HttpError(404, "User not found", "USER_NOT_FOUND");
  }

  return user;
}

export async function listUsers(tenantId: string) {
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
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function inviteUser(input: {
  tenantId: string;
  actorUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  ip?: string;
}) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findFirst({
    where: { tenantId: input.tenantId, email },
  });

  if (existing?.isActive) {
    throw new HttpError(
      409,
      "An active user with this email already exists",
      "USER_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash,
          isActive: false,
        },
      })
    : await prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          passwordHash,
          isActive: false,
        },
      });

  const token = makeInviteToken();

  await redis.set(
    `user:invite:${token}`,
    JSON.stringify({
      tenantId: input.tenantId,
      userId: user.id,
      email: user.email,
    }),
    "EX",
    USER_INVITE_TTL_SECONDS,
  );

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "INVITE_USER",
    entity: "User",
    entityId: user.id,
    after: { email: user.email, role: user.role },
    ip: input.ip,
  });

  return {
    user,
    token,
    expiresInSeconds: USER_INVITE_TTL_SECONDS,
  };
}

export async function acceptInvite(input: { token: string; password: string }) {
  const raw = await redis.get(`user:invite:${input.token}`);

  if (!raw) {
    throw new HttpError(
      401,
      "Invite token is invalid or expired",
      "INVALID_INVITE_TOKEN",
    );
  }

  const payload = JSON.parse(raw) as {
    tenantId: string;
    userId: string;
    email: string;
  };
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.update({
    where: { id: payload.userId },
    data: {
      passwordHash,
      isActive: true,
    },
  });

  await redis.del(`user:invite:${input.token}`);

  return user;
}

export async function updateUserRole(input: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  role: UserRole;
  ip?: string;
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new HttpError(
      400,
      "An admin cannot change their own role",
      "SELF_ROLE_CHANGE_DENIED",
    );
  }

  const target = await getTenantUserOrThrow(input.tenantId, input.targetUserId);

  if (target.isOwner && target.role === "ADMIN" && input.role !== "ADMIN") {
    throw new HttpError(
      403,
      "The founding owner admin cannot be demoted by tenant admins",
      "OWNER_DEMOTION_DENIED",
    );
  }

  if (target.role === "ADMIN" && input.role !== "ADMIN") {
    const adminCount = await countActiveAdmins(input.tenantId);
    if (adminCount <= 1) {
      throw new HttpError(
        400,
        "Cannot demote the only active Admin",
        "LAST_ADMIN_REQUIRED",
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: input.role },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "UPDATE_USER_ROLE",
    entity: "User",
    entityId: updated.id,
    before: { role: target.role },
    after: { role: updated.role },
    ip: input.ip,
  });

  return updated;
}

export async function deactivateUser(input: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  ip?: string;
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new HttpError(
      400,
      "An admin cannot deactivate themselves",
      "SELF_DEACTIVATION_DENIED",
    );
  }

  const target = await getTenantUserOrThrow(input.tenantId, input.targetUserId);

  if (target.isOwner) {
    throw new HttpError(
      403,
      "The founding owner admin cannot be deactivated by tenant admins",
      "OWNER_DEACTIVATION_DENIED",
    );
  }

  if (target.role === "ADMIN") {
    const adminCount = await countActiveAdmins(input.tenantId);
    if (adminCount <= 1) {
      throw new HttpError(
        400,
        "Cannot deactivate the only active Admin",
        "LAST_ADMIN_REQUIRED",
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "DEACTIVATE_USER",
    entity: "User",
    entityId: updated.id,
    before: { isActive: target.isActive },
    after: { isActive: updated.isActive },
    ip: input.ip,
  });

  return updated;
}

export async function reactivateUser(input: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  ip?: string;
}) {
  const target = await getTenantUserOrThrow(input.tenantId, input.targetUserId);
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { isActive: true },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "REACTIVATE_USER",
    entity: "User",
    entityId: updated.id,
    before: { isActive: target.isActive },
    after: { isActive: updated.isActive },
    ip: input.ip,
  });

  return updated;
}

export async function resetUserPassword(input: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  password: string;
  ip?: string;
}) {
  const target = await getTenantUserOrThrow(input.tenantId, input.targetUserId);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      refreshTokens: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      },
    },
  });

  await logTenantAudit({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    action: "RESET_USER_PASSWORD",
    entity: "User",
    entityId: updated.id,
    ip: input.ip,
  });

  return updated;
}
