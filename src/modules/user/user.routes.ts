import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireTenantAdmin } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as userController from './user.controller.js';
import {
  acceptInviteSchema,
  inviteUserSchema,
  resetUserPasswordSchema,
  updateUserRoleSchema,
  userIdParamsSchema
} from './user.schemas.js';

export const userRouter = Router();

userRouter.post('/accept-invite', validate({ body: acceptInviteSchema }), asyncHandler(userController.acceptInvite));

userRouter.use(authenticate, requireTenantAdmin);

userRouter.get('/', asyncHandler(userController.list));
userRouter.post('/invite', validate({ body: inviteUserSchema }), asyncHandler(userController.invite));
userRouter.patch(
  '/:id/role',
  validate({ params: userIdParamsSchema, body: updateUserRoleSchema }),
  asyncHandler(userController.updateRole)
);
userRouter.patch(
  '/:id/deactivate',
  validate({ params: userIdParamsSchema }),
  asyncHandler(userController.deactivate)
);
userRouter.patch(
  '/:id/reactivate',
  validate({ params: userIdParamsSchema }),
  asyncHandler(userController.reactivate)
);
userRouter.patch(
  '/:id/password',
  validate({ params: userIdParamsSchema, body: resetUserPasswordSchema }),
  asyncHandler(userController.resetPassword)
);
