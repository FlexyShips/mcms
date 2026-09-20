import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireTenantAdmin } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as tenantController from './tenant.controller.js';
import { updateTenantProfileSchema } from './tenant.schemas.js';

export const tenantRouter = Router();

tenantRouter.use(authenticate);
tenantRouter.get('/profile', asyncHandler(tenantController.getProfile));
tenantRouter.patch(
  '/profile',
  requireTenantAdmin,
  validate({ body: updateTenantProfileSchema }),
  asyncHandler(tenantController.updateProfile),
);
