import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorize.middleware.js';
import { getVesselOrThrow } from '../../middlewares/vesselScope.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as vesselController from './vessel.controller.js';
import {
  assignSuperintendentSchema,
  createVesselSchema,
  updateVesselSchema,
  vesselIdParamsSchema,
} from './vessel.schemas.js';
import { enforceVesselLimit } from '../../middlewares/planLimit.middleware.js';
import { requireModule } from '../../middlewares/module.middleware.js';
import { HttpError } from '../../utils/httpError.js';

const vesselMigrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls)$/i.test(file.originalname)) {
      callback(null, true);
    } else {
      callback(new HttpError(400, 'Only .xlsx or .xls files are supported', 'INVALID_FILE'));
    }
  },
});

function uploadVesselMigration(req: Request, res: Response, next: NextFunction) {
  vesselMigrationUpload.single('file')(req, res, (error) => {
    if (error)
      return next(
        error instanceof HttpError ? error : new HttpError(400, 'Invalid upload', 'INVALID_FILE'),
      );
    next();
  });
}

export const vesselRouter = Router();

vesselRouter.use(authenticate);

vesselRouter.get('/', requirePermission('fleet:read'), asyncHandler(vesselController.list));
vesselRouter.post(
  '/',

  requirePermission('vessels:write'),
  enforceVesselLimit,
  validate({ body: createVesselSchema }),
  asyncHandler(vesselController.create),
);
vesselRouter.get(
  '/migration/template',
  requirePermission('vessels:write'),
  requireModule('excelMigration'),
  asyncHandler(vesselController.downloadMigrationTemplate),
);
vesselRouter.post(
  '/migration',
  requirePermission('vessels:write'),
  requireModule('excelMigration'),
  uploadVesselMigration,
  asyncHandler(vesselController.migrate),
);

vesselRouter.use('/:id', getVesselOrThrow);
vesselRouter.get(
  '/:id',
  requirePermission('vessels:read'),
  validate({ params: vesselIdParamsSchema }),
  asyncHandler(vesselController.get),
);
vesselRouter.patch(
  '/:id',
  requirePermission('vessels:write'),
  validate({ params: vesselIdParamsSchema, body: updateVesselSchema }),
  asyncHandler(vesselController.update),
);
vesselRouter.patch(
  '/:id/superintendent',
  requirePermission('vessels:write'),
  validate({ params: vesselIdParamsSchema, body: assignSuperintendentSchema }),
  asyncHandler(vesselController.assignSuperintendent),
);
vesselRouter.delete(
  '/:id',
  requirePermission('vessels:write'),
  validate({ params: vesselIdParamsSchema }),
  asyncHandler(vesselController.remove),
);
