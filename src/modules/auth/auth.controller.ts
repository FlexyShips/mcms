import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { setCookie } from '../../utils/cookies.js';
import { env } from '../../config/env.js';

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  secure: env.NODE_ENV === 'production',
};

export async function login(req: Request, res: Response) {
  const tokens = await authService.login({
    tenantSlug: req.body.tenantSlug,
    tenantId: req.tenantId,
    email: req.body.email,
    password: req.body.password,
  });

  setCookie(res, 'accessToken', tokens.accessToken, authCookieOptions);
  setCookie(res, 'refreshToken', tokens.refreshToken, authCookieOptions);

  if (req.tenantId) {
    setCookie(res, 'tenantId', req.tenantId, { ...authCookieOptions, httpOnly: false });
    res.setHeader('X-Tenant-ID', req.tenantId);
  }

  if (req.tenant?.slug) {
    setCookie(res, 'tenantSlug', req.tenant.slug, { ...authCookieOptions, httpOnly: false });
    res.setHeader('X-Tenant-Slug', req.tenant.slug);
  }

  res.json(tokens);
}

export async function refresh(req: Request, res: Response) {
  const tokens = await authService.refresh(req.body.refreshToken);

  res.json(tokens);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);

  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
