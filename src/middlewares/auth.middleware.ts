import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../modules/auth/jwt.service.js';

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (!header) return undefined;

  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;

  return token;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return next(new HttpError(401, 'Bearer token is required', 'AUTH_REQUIRED'));
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true }
    });

    if (!user || !user.isActive) {
      return next(new HttpError(401, 'Authenticated user is inactive or missing', 'USER_INACTIVE'));
    }

    if (user.tenantId !== payload.tenantId || user.role !== payload.role) {
      return next(new HttpError(401, 'Token claims do not match current user state', 'TOKEN_STALE'));
    }

    if (!['TRIAL', 'ACTIVE'].includes(user.tenant.status)) {
      return next(new HttpError(403, 'Tenant account is not active', 'TENANT_NOT_ACTIVE'));
    }

    if (req.tenantId && req.tenantId !== user.tenantId) {
      return next(new HttpError(403, 'Authenticated user does not belong to this tenant', 'TENANT_MISMATCH'));
    }

    req.tenantId = user.tenantId;
    req.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      status: user.tenant.status
    };
    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isOwner: user.isOwner
    };

    next();
  } catch (error) {
    next(error);
  }
}
