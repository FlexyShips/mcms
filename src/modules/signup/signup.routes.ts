import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as signupController from './signup.controller.js';
import {
  createSignupSchema,
  resendVerifyEmailTokenSchema,
  verifyEmailTokenSchema,
} from './signup.schemas.js';

export const signupRouter = Router();

signupRouter.post(
  '/',
  authLimiter,
  validate({ body: createSignupSchema }),
  asyncHandler(signupController.createSignup),
);
signupRouter.post(
  '/verify-email',
  authLimiter,
  validate({ query: verifyEmailTokenSchema }),
  asyncHandler(signupController.verifySignupTokenAndCompleteReg),
);
signupRouter.post(
  '/resend-email-token',
  authLimiter,
  validate({ body: resendVerifyEmailTokenSchema }),
  asyncHandler(signupController.resendEmailVerificationToken),
);
signupRouter.get('/slug/:slug', asyncHandler(signupController.checkSlug));
signupRouter.get('/status/:reference', asyncHandler(signupController.signupStatus));
signupRouter.get('/callback', asyncHandler(signupController.signupCallback));
