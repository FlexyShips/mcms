import type { Request, Response } from 'express';
import * as vesselService from './vessel.service.js';

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

export async function downloadMigrationTemplate(_req: Request, res: Response) {
  const { createVesselMigrationTemplate } = await import('./vessel-migration.js');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="vessel-migration-template.xlsx"');
  res.send(createVesselMigrationTemplate());
}

export async function migrate(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({
      error: { code: 'FILE_REQUIRED', message: 'An Excel file is required in the file field' },
    });
    return;
  }

  const result = await vesselService.migrateVessels({
    tenantId: req.tenantId!,
    actorUserId: req.user!.id,
    userRole: req.user!.role,
    ip: req.ip,
    file: req.file.buffer,
    originalName: req.file.originalname,
  });
  res.status(201).json(result);
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
    actorUserId: req.user!.id,
    ip: req.ip,
    superintendentId: req.body.superintendentId,
  });
  res.json({ vessel });
}

export async function remove(req: Request, res: Response) {
  await vesselService.deleteVessel(req.tenantId!, req.params.id, req.user!.role);
  res.status(204).send();
}
