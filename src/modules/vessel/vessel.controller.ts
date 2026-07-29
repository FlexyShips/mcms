import type { Request, Response } from "express";
import * as vesselService from "./vessel.service.js";

export async function list(req: Request, res: Response) {
  const vessels = await vesselService.listVessels(req.tenantId!, req.user!);
  res.json({ vessels });
}

export async function create(req: Request, res: Response) {
  const vessel = await vesselService.createVessel({
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    ...req.body,
  });
  res.status(201).json({ vessel });
}

export async function get(req: Request, res: Response) {
  const vessel = await vesselService.getVessel(req.tenantId!, req.params.id);
  res.json({ vessel });
}

export async function update(req: Request, res: Response) {
  const vessel = await vesselService.updateVessel({
    tenantId: req.tenantId!,
    vesselId: req.params.id,
    userRole: req.user!.role,
    data: req.body,
  });
  res.json({ vessel });
}

export async function assignSuperintendent(req: Request, res: Response) {
  const vessel = await vesselService.assignSuperintendent({
    tenantId: req.tenantId!,
    vesselId: req.params.id,
    userRole: req.user!.role,
    superintendentId: req.body.superintendentId,
  });
  res.json({ vessel });
}

export async function remove(req: Request, res: Response) {
  await vesselService.deleteVessel(
    req.tenantId!,
    req.params.id,
    req.user!.role,
  );
  res.status(204).send();
}
