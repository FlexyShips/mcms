import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/authorize.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { getVesselOrThrow } from "../../middlewares/vesselScope.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as certificateController from "./certificate.controller.js";
import {
  certificateIdParamsSchema,
  createCertificateSchema,
  updateCertificateSchema,
  uploadCertificateSchema,
  vesselCertificateParamsSchema,
} from "./certificate.schemas.js";

export const certificateRouter = Router();

certificateRouter.use(authenticate);

certificateRouter.get(
  "/vessels/:vesselId/certificates",
  requirePermission("certificates:read"),
  validate({ params: vesselCertificateParamsSchema }),
  getVesselOrThrow,
  certificateController.list,
);

certificateRouter.post(
  "/vessels/:vesselId/certificates",
  requirePermission("certificates:write"),
  validate({
    params: vesselCertificateParamsSchema,
    body: createCertificateSchema,
  }),
  getVesselOrThrow,
  certificateController.create,
);

certificateRouter.get(
  "/vessels/:vesselId/certificates/:certId",
  requirePermission("certificates:read"),
  validate({ params: certificateIdParamsSchema }),
  getVesselOrThrow,
  certificateController.getOne,
);

certificateRouter.patch(
  "/vessels/:vesselId/certificates/:certId",
  requirePermission("certificates:write"),
  validate({
    params: certificateIdParamsSchema,
    body: updateCertificateSchema,
  }),
  getVesselOrThrow,
  certificateController.update,
);

certificateRouter.delete(
  "/vessels/:vesselId/certificates/:certId",
  requirePermission("certificates:write"),
  validate({ params: certificateIdParamsSchema }),
  getVesselOrThrow,
  certificateController.remove,
);

certificateRouter.post(
  "/vessels/:vesselId/certificates/:certId/upload",
  requirePermission("certificates:write"),
  validate({
    params: certificateIdParamsSchema,
    body: uploadCertificateSchema,
  }),
  getVesselOrThrow,
  certificateController.upload,
);

export default certificateRouter;
