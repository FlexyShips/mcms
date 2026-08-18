import type { Request, Response } from 'express';
import { requireTenantId } from '../../lib/tenantScope.js';
import * as userService from './user.service.js';

export async function list(req: Request, res: Response) {
  const users = await userService.listUsers(requireTenantId(req.tenantId));
  res.json({ users });
}

export async function invite(req: Request, res: Response) {
  const result = await userService.inviteUser({
    tenantId: requireTenantId(req.tenantId),
    actorUserId: req.user!.id,
    email: req.body.email,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    role: req.body.role,
    ip: req.ip,
  });

  res.status(201).json(result);
}

export async function acceptInvite(req: Request, res: Response) {
  const user = await userService.acceptInvite(req.body);
  res.json({ user });
}

export async function updateRole(req: Request, res: Response) {
  const user = await userService.updateUserRole({
    tenantId: requireTenantId(req.tenantId),
    actorUserId: req.user!.id,
    targetUserId: req.params.id,
    role: req.body.role,
    ip: req.ip,
  });

  res.json({ user });
}

export async function deactivate(req: Request, res: Response) {
  const user = await userService.deactivateUser({
    tenantId: requireTenantId(req.tenantId),
    actorUserId: req.user!.id,
    targetUserId: req.params.id,
    ip: req.ip,
  });

  res.json({ user });
}

export async function reactivate(req: Request, res: Response) {
  const user = await userService.reactivateUser({
    tenantId: requireTenantId(req.tenantId),
    actorUserId: req.user!.id,
    targetUserId: req.params.id,
    ip: req.ip,
  });

  res.json({ user });
}

export async function resetPassword(req: Request, res: Response) {
  const user = await userService.resetUserPassword({
    tenantId: requireTenantId(req.tenantId),
    actorUserId: req.user!.id,
    targetUserId: req.params.id,
    password: req.body.password,
    ip: req.ip,
  });

  res.json({ user });
}
