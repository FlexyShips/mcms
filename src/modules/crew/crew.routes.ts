import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as crewController from './crew.controller.js';
import {
  assignCrewSchema,
  createCrewSchema,
  crewIdParamsSchema,
  updateCrewSchema,
  crewCertificateParamsSchema,
  crewCertificateSchema,
  crewDocumentParamsSchema,
  crewDocumentSchema,
} from './crew.schemas.js';

export const crewRouter = Router();

crewRouter.use(authenticate);

crewRouter.get('/', requirePermission('crew:read'), asyncHandler(crewController.list));
crewRouter.post(
  '/',
  requirePermission('crew:write'),
  validate({ body: createCrewSchema }),
  asyncHandler(crewController.create),
);
crewRouter.get(
  '/:id',
  requirePermission('crew:read'),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.get),
);
crewRouter.patch(
  '/:id',
  requirePermission('crew:write'),
  validate({ params: crewIdParamsSchema, body: updateCrewSchema }),
  asyncHandler(crewController.update),
);
crewRouter.post(
  '/:id/assign',
  requirePermission('crew:write'),
  validate({ params: crewIdParamsSchema, body: assignCrewSchema }),
  asyncHandler(crewController.assign),
);
crewRouter.delete(
  '/:id',
  requirePermission('crew:write'),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.remove),
);

crewRouter.get(
  '/:id/certificates',
  requirePermission('certificates:read'),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.listCertificates),
);
crewRouter.post(
  '/:id/certificates',
  requirePermission('certificates:write'),
  validate({ params: crewIdParamsSchema, body: crewCertificateSchema }),
  asyncHandler(crewController.createCertificate),
);
crewRouter.get(
  '/:id/certificates/:certId',
  requirePermission('certificates:read'),
  validate({ params: crewCertificateParamsSchema }),
  asyncHandler(crewController.getCertificate),
);
crewRouter.patch(
  '/:id/certificates/:certId',
  requirePermission('certificates:write'),
  validate({ params: crewCertificateParamsSchema, body: crewCertificateSchema.partial() }),
  asyncHandler(crewController.updateCertificate),
);
crewRouter.delete(
  '/:id/certificates/:certId',
  requirePermission('certificates:write'),
  validate({ params: crewCertificateParamsSchema }),
  asyncHandler(crewController.deleteCertificate),
);
crewRouter.get(
  '/:id/documents',
  requirePermission('documents:read'),
  validate({ params: crewIdParamsSchema }),
  asyncHandler(crewController.listDocuments),
);
crewRouter.post(
  '/:id/documents',
  requirePermission('documents:write'),
  validate({ params: crewIdParamsSchema, body: crewDocumentSchema }),
  asyncHandler(crewController.createDocument),
);
crewRouter.delete(
  '/:id/documents/:documentId',
  requirePermission('documents:write'),
  validate({ params: crewDocumentParamsSchema }),
  asyncHandler(crewController.deleteDocument),
);
