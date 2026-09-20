import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorize.middleware.js';
import { requireModule } from '../../middlewares/module.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as reportController from './report.controller.js';
import {
  generateReportSchema,
  reportHistoryQuerySchema,
  reportIdParamsSchema,
  vesselReportParamsSchema,
  vesselReportPreviewQuerySchema,
} from './report.schemas.js';

export const reportRouter = Router();

reportRouter.use(authenticate, requirePermission('reports:read'), requireModule('reporting'));
reportRouter.get(
  '/vessels/:vesselId/preview',
  validate({ params: vesselReportParamsSchema, query: vesselReportPreviewQuerySchema }),
  asyncHandler(reportController.preview),
);
reportRouter.post(
  '/generate',
  validate({ body: generateReportSchema }),
  asyncHandler(reportController.generate),
);
reportRouter.get(
  '/history',
  validate({ query: reportHistoryQuerySchema }),
  asyncHandler(reportController.history),
);
reportRouter.get(
  '/:id/status',
  validate({ params: reportIdParamsSchema }),
  asyncHandler(reportController.status),
);
reportRouter.get(
  '/:id/download',
  validate({ params: reportIdParamsSchema }),
  asyncHandler(reportController.download),
);
