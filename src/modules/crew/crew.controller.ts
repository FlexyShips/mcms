import type { Request, Response } from "express";
import * as crewService from "./crew.service.js";

export async function list(req: Request, res: Response) {
  const crew = await crewService.listCrew(req.tenantId!, req.user!);
  res.json({ crew });
}

export async function create(req: Request, res: Response) {
  const crewMember = await crewService.createCrew({
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    ...req.body,
  });
  res.status(201).json({ crewMember });
}

export async function get(req: Request, res: Response) {
  const crewMember = await crewService.getCrew(
    req.tenantId!,
    req.params.id,
    req.user!,
  );
  res.json({ crewMember });
}

export async function update(req: Request, res: Response) {
  const crewMember = await crewService.updateCrew({
    tenantId: req.tenantId!,
    crewId: req.params.id,
    userRole: req.user!.role,
    userId: req.user!.id,
    data: req.body,
  });
  res.json({ crewMember });
}

export async function assign(req: Request, res: Response) {
  const assignment = await crewService.assignCrew({
    tenantId: req.tenantId!,
    crewId: req.params.id,
    userRole: req.user!.role,
    vesselId: req.body.vesselId,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
  });
  res.json({ assignment });
}

export async function remove(req: Request, res: Response) {
  await crewService.deleteCrew(req.tenantId!, req.params.id, req.user!.role);
  res.status(204).send();
}
