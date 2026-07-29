import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { durationToDate } from "../../utils/duration.js";
import { HttpError } from "../../utils/httpError.js";
import { hashToken } from "../../utils/tokenHash.js";
import { env } from "../../config/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./jwt.service.js";
import type { AuthTokens } from "./auth.types.js";

type LoginInput = {
  tenantSlug?: string;
  tenantId?: string;
  email: string;
  password: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createTokenPair(user: {
  id: string;
  tenantId: string;
  role: import("../../generated/prisma/client.js").UserRole;
  isOwner: boolean;
}): Promise<AuthTokens> {
  const tokenRecord = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: `pending:${randomUUID()}`,
      expiresAt: durationToDate(env.JWT_REFRESH_TTL),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    isOwner: user.isOwner,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    tenantId: user.tenantId,
    tokenId: tokenRecord.id,
  });

  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { token: hashToken(refreshToken) },
  });

  return { accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const email = normalizeEmail(input.email);

  if (!input.tenantId && !input.tenantSlug) {
    throw new HttpError(
      400,
      "Tenant slug or tenant context is required for login",
      "TENANT_REQUIRED",
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      tenantId: input.tenantId,
      tenant: input.tenantSlug ? { slug: input.tenantSlug } : undefined,
    },
    include: { tenant: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(
      401,
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  if (!["TRIAL", "ACTIVE"].includes(user.tenant.status)) {
    throw new HttpError(
      403,
      "Tenant account is not active",
      "TENANT_NOT_ACTIVE",
    );
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new HttpError(
      401,
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return createTokenPair(user);
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
    include: {
      user: {
        include: { tenant: true },
      },
    },
  });

  if (
    !storedToken ||
    storedToken.token !== tokenHash ||
    storedToken.revokedAt ||
    storedToken.expiresAt <= new Date()
  ) {
    throw new HttpError(
      401,
      "Refresh token has been revoked or expired",
      "REFRESH_TOKEN_REVOKED",
    );
  }

  if (
    !storedToken.user.isActive ||
    !["TRIAL", "ACTIVE"].includes(storedToken.user.tenant.status)
  ) {
    throw new HttpError(403, "Account is not active", "ACCOUNT_NOT_ACTIVE");
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  return createTokenPair(storedToken.user);
}

export async function logout(refreshToken: string): Promise<void> {
  const payload = verifyRefreshToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      id: payload.tokenId,
      token: hashToken(refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
