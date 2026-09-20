import type { Request, Response } from 'express';
import * as signupService from './signup.service.js';
import { env } from '../../config/env.js';

//  first we first sign the payload to a token and embed it to the url
//  on clicking of that link we decode everything and then call the sign up method

export async function createSignup(req: Request, res: Response) {
  const result = await signupService.signupToken(req.body);
  res.status(201).json(result);
}
export async function verifySignupTokenAndCompleteReg(req: Request, res: Response) {
  const result = await signupService.verifySignupTokenAndCompleteReg(
    req.query as { token: string },
  );
  res.status(201).json({
    reference: result.reference,
    checkoutUrl: result.checkoutUrl,
    provider: result.provider,
    message: result.checkoutUrl
      ? 'Please complete payment to activate your account'
      : 'Your account is ready! Redirecting to your workspace...',
  });
  res.status(201).json(result);
}

export async function resendEmailVerificationToken(req: Request, res: Response) {
  const result = await signupService.resendEmailVerificationToken(req.body);
  res.status(201).json(result);
}

export async function checkSlug(req: Request, res: Response) {
  const { slug } = req.params;
  const result = await signupService.checkSlugAvailability(slug);
  res.json(result);
}

export async function signupStatus(req: Request, res: Response) {
  const { reference } = req.params;
  const result = await signupService.getSignupStatus(reference);
  res.json(result);
}

export async function signupCallback(req: Request, res: Response) {
  const { reference } = req.query;

  if (!reference || typeof reference !== 'string') {
    return res.redirect(`${env.APP_URL}/signup`);
  }

  try {
    const status = await signupService.getSignupStatus(reference);

    if (status.status === 'ACTIVE') {
      return res.redirect(`https://${status.slug}.${env.FRONTEND_DOMAIN}/login?autologin=true`);
    }

    if (status.status === 'AWAITING_PAYMENT') {
      return res.redirect(`${env.APP_URL}/signup/pending?slug=${status.slug}`);
    }

    return res.redirect(`${env.APP_URL}/signup?slug=${status.slug}`);
  } catch {
    return res.redirect(`${env.APP_URL}/signup`);
  }
}
