import type { Request, Response } from 'express';
import * as authService from './auth.service.js';

export async function login(req: Request, res: Response) {
  const tokens = await authService.login({
    tenantSlug: req.body.tenantSlug,
    tenantId: req.tenantId,
    email: req.body.email,
    password: req.body.password
  });

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
