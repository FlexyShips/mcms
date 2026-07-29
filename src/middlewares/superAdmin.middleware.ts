import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifySuperAdminAccessToken } from '../modules/auth/jwt.service.js';
import { HttpError } from '../utils/httpError.js';

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return next(new HttpError(401, 'Super admin bearer token is required', 'SUPER_ADMIN_AUTH_REQUIRED'));
    }

    const payload = verifySuperAdminAccessToken(token);
    const superAdmin = await prisma.superAdmin.findUnique({ where: { id: payload.sub } });

    if (!superAdmin || !superAdmin.isActive) {
      return next(new HttpError(401, 'Super admin account is inactive or missing', 'SUPER_ADMIN_INACTIVE'));
    }

    req.superAdmin = {
      id: superAdmin.id,
      email: superAdmin.email
    };

    next();
  } catch (error) {
    next(error);
  }
}
