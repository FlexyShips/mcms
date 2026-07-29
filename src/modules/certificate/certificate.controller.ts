import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createCertificateSchema,
  updateCertificateSchema,
  uploadCertificateSchema,
  vesselCertificateParamsSchema,
  certificateIdParamsSchema,
} from "./certificate.schemas.js";
import {
  createVesselCertificate,
  deleteVesselCertificate,
  getVesselCertificate,
  listVesselCertificates,
  updateVesselCertificate,
  uploadVesselCertificateFile,
} from "./certificate.service.js";

function getContext(req: Request) {
  return {
    tenantId: req.tenantId!,
    vesselId: req.params.vesselId,
    userRole: req.user!.role,
    userId: req.user!.id,
  };
}

export const list = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = vesselCertificateParamsSchema.parse(req.params);
    const context = { ...getContext(req), vesselId: parsed.vesselId };
    const certificates = await listVesselCertificates(context);
    return res.status(200).json({ data: certificates });
  },
);

export const create = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = vesselCertificateParamsSchema.parse(req.params);
    const body = createCertificateSchema.parse(req.body);
    const certificate = await createVesselCertificate({
      ...getContext(req),
      vesselId: parsed.vesselId,
      data: body,
    });
    return res.status(201).json({ data: certificate });
  },
);

export const getOne = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = certificateIdParamsSchema.parse(req.params);
    const certificate = await getVesselCertificate({
      ...getContext(req),
      vesselId: parsed.vesselId,
      certificateId: parsed.certId,
    });
    return res.status(200).json({ data: certificate });
  },
);

export const update = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = certificateIdParamsSchema.parse(req.params);
    const body = updateCertificateSchema.parse(req.body);
    const certificate = await updateVesselCertificate({
      ...getContext(req),
      vesselId: parsed.vesselId,
      certificateId: parsed.certId,
      data: body,
    });
    return res.status(200).json({ data: certificate });
  },
);

export const remove = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = certificateIdParamsSchema.parse(req.params);
    await deleteVesselCertificate({
      ...getContext(req),
      vesselId: parsed.vesselId,
      certificateId: parsed.certId,
    });
    return res.status(204).send();
  },
);

export const upload = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = certificateIdParamsSchema.parse(req.params);
    const payload = uploadCertificateSchema.parse(req.body);
    const certificate = await uploadVesselCertificateFile({
      ...getContext(req),
      vesselId: parsed.vesselId,
      certificateId: parsed.certId,
      fileUrl: payload.fileUrl,
      fileKey: payload.fileKey,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    });
    return res.status(200).json({ data: certificate });
  },
);
