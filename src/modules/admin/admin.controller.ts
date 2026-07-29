import type { Request, Response } from "express";
import * as adminService from "./admin.service.js";

export async function superAdminLogin(req: Request, res: Response) {
  const result = await adminService.loginSuperAdmin(req.body);
  res.json(result);
}

export async function listTenants(req: Request, res: Response) {
  const tenants = await adminService.listTenants();
  res.json({ tenants });
}

export async function getTenant(req: Request, res: Response) {
  const tenant = await adminService.getTenant(req.params.tenantId);
  res.json({ tenant });
}

export async function updateTenantModules(req: Request, res: Response) {
  const settings = await adminService.updateTenantModules({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
    data: req.body,
  });
  res.json({ settings });
}

export async function suspendTenant(req: Request, res: Response) {
  const tenant = await adminService.suspendTenant({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
    reason: req.body.reason,
  });
  res.json({ tenant });
}

export async function reactivateTenant(req: Request, res: Response) {
  const tenant = await adminService.reactivateTenant({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
  });
  res.json({ tenant });
}

export async function listTenantUsers(req: Request, res: Response) {
  const users = await adminService.listTenantUsers(req.params.tenantId);
  res.json({ users });
}

export async function createTenantAdmin(req: Request, res: Response) {
  const user = await adminService.createTenantAdmin({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
    email: req.body.email,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    password: req.body.password,
  });
  res.status(201).json({ user });
}

export async function transferOwnership(req: Request, res: Response) {
  const user = await adminService.transferOwnership({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
    targetUserId: req.body.targetUserId,
  });
  res.json({ user });
}

export async function deactivateTenantUser(req: Request, res: Response) {
  const user = await adminService.deactivateTenantUser({
    tenantId: req.params.tenantId,
    superAdminId: req.superAdmin!.id,
    userId: req.params.userId,
  });
  res.json({ user });
}

export async function listAuditLogs(req: Request, res: Response) {
  const logs = await adminService.listSuperAdminAuditLogs();
  res.json({ logs });
}
