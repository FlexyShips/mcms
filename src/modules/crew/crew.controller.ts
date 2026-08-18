import type { Request, Response } from 'express';
import * as crewService from './crew.service.js';
import * as complianceService from './crew-compliance.service.js';

export async function list(req: Request, res: Response) {
  const crew = await crewService.listCrew(req.tenantId!, req.user!);
  res.json({ crew });
}

export async function create(req: Request, res: Response) {
  const crewMember = await crewService.createCrew({
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    actorUserId: req.user!.id,
    ...req.body,
  });
  res.status(201).json({ crewMember });
}

export async function get(req: Request, res: Response) {
  const crewMember = await crewService.getCrew(req.tenantId!, req.params.id, req.user!);
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
    actorUserId: req.user!.id,
    ip: req.ip,
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

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

export async function listCertificates(req: Request, res: Response) {
  res.json({
    data: await complianceService.listCrewCertificates({
      tenantId: req.tenantId!,
      crewId: req.params.id,
      actor: actor(req),
    }),
  });
}
export async function getCertificate(req: Request, res: Response) {
  res.json({
    data: await complianceService.getCrewCertificate({
      tenantId: req.tenantId!,
      crewId: req.params.id,
      certificateId: req.params.certId,
      actor: actor(req),
    }),
  });
}
export async function createCertificate(req: Request, res: Response) {
  res
    .status(201)
    .json({
      data: await complianceService.createCrewCertificate({
        tenantId: req.tenantId!,
        crewId: req.params.id,
        actor: actor(req),
        data: req.body,
      }),
    });
}
export async function updateCertificate(req: Request, res: Response) {
  res.json({
    data: await complianceService.updateCrewCertificate({
      tenantId: req.tenantId!,
      crewId: req.params.id,
      certificateId: req.params.certId,
      actor: actor(req),
      data: req.body,
    }),
  });
}
export async function deleteCertificate(req: Request, res: Response) {
  await complianceService.deleteCrewCertificate({
    tenantId: req.tenantId!,
    crewId: req.params.id,
    certificateId: req.params.certId,
    actor: actor(req),
  });
  res.status(204).send();
}
export async function listDocuments(req: Request, res: Response) {
  res.json({
    data: await complianceService.listCrewDocuments({
      tenantId: req.tenantId!,
      crewId: req.params.id,
      actor: actor(req),
    }),
  });
}
export async function createDocument(req: Request, res: Response) {
  res
    .status(201)
    .json({
      data: await complianceService.createCrewDocument({
        tenantId: req.tenantId!,
        crewId: req.params.id,
        actor: actor(req),
        data: req.body,
      }),
    });
}
export async function deleteDocument(req: Request, res: Response) {
  await complianceService.deleteCrewDocument({
    tenantId: req.tenantId!,
    crewId: req.params.id,
    documentId: req.params.documentId,
    actor: actor(req),
  });
  res.status(204).send();
}
