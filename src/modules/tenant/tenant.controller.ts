import type { Request, Response } from 'express';
import { requireTenantId } from '../../lib/tenantScope.js';
import * as tenantService from './tenant.service.js';

export async function getProfile(req: Request, res: Response) {
  const profile = await tenantService.getTenantProfile(requireTenantId(req.tenantId));
  res.json({ profile });
}

export async function updateProfile(req: Request, res: Response) {
  const profile = await tenantService.updateTenantProfile({
    tenantId: requireTenantId(req.tenantId),
    userId: req.user!.id,
    ip: req.ip,
    data: req.body,
  });

  res.json({ profile });
}
