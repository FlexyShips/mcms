import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';

export async function getVesselOrThrow(req: Request, _res: Response, next: NextFunction) {
  try {
    const vesselId = req.params.vesselId ?? req.params.id;

    if (!vesselId) {
      return next(new HttpError(400, 'Vessel id route parameter is required', 'VESSEL_ID_REQUIRED'));
    }

    if (!req.user || !req.tenantId) {
      return next(new HttpError(401, 'Authentication is required', 'AUTH_REQUIRED'));
    }

    const vessel = await prisma.vessel.findFirst({
      where: {
        id: vesselId,
        tenantId: req.tenantId
      }
    });

    if (!vessel) {
      return next(new HttpError(404, 'Vessel not found', 'VESSEL_NOT_FOUND'));
    }

    if (
      req.user.role === 'MARINE_SUPERINTENDENT' &&
      vessel.assignedSuperintendentId !== req.user.id
    ) {
      return next(new HttpError(403, 'You can only access assigned vessels', 'VESSEL_SCOPE_DENIED'));
    }

    req.vessel = vessel;
    next();
  } catch (error) {
    next(error);
  }
}
