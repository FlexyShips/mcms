import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as authController from './auth.controller.js';
import { loginSchema, logoutSchema, refreshTokenSchema } from './auth.schemas.js';
import * as onboardingController from '../onboarding/onboarding.controller.js';
import { onboardSchema } from '../onboarding/onboarding.schemas.js';

export const authRouter = Router();

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post('/onboard', authLimiter, validate({ body: onboardSchema }), asyncHandler(onboardingController.onboard));
authRouter.post('/refresh', authLimiter, validate({ body: refreshTokenSchema }), asyncHandler(authController.refresh));
authRouter.post('/logout', validate({ body: logoutSchema }), asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
