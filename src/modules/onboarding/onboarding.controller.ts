import type { Request, Response } from 'express';
import * as onboardingService from './onboarding.service.js';

export async function onboard(req: Request, res: Response) {
  const result = await onboardingService.onboard(req.body);

  res.status(201).json(result);
}
