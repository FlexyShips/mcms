import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  addCommentSchema,
  advanceStageSchema,
  createRenewalSchema,
  listRenewalsQuerySchema,
  renewalIdParamsSchema,
} from "./renewal.schemas.js";
import {
  addRenewalComment,
  advanceRenewalStage,
  createRenewal,
  getRenewal,
  getRenewalKanban,
  listRenewals,
} from "./renewal.service.js";

function getContext(req: Request) {
  return {
    tenantId: req.tenantId!,
    userRole: req.user!.role,
    userId: req.user!.id,
  };
}

export const list = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = listRenewalsQuerySchema.parse(req.query);
    const renewals = await listRenewals({ ...getContext(req), ...query });
    return res.status(200).json({ data: renewals });
  },
);

export const getOne = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = renewalIdParamsSchema.parse(req.params);
    const renewal = await getRenewal({
      ...getContext(req),
      renewalId: params.id,
    });
    return res.status(200).json({ data: renewal });
  },
);

export const create = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = createRenewalSchema.parse(req.body);
    const renewal = await createRenewal({
      ...getContext(req),
      ...body,
      dueDate: body.dueDate,
    });
    return res.status(201).json({ data: renewal });
  },
);

export const advanceStage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = renewalIdParamsSchema.parse(req.params);
    const body = advanceStageSchema.parse(req.body);
    const renewal = await advanceRenewalStage({
      ...getContext(req),
      renewalId: params.id,
      ...body,
    });
    return res.status(200).json({ data: renewal });
  },
);

export const addComment = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = renewalIdParamsSchema.parse(req.params);
    const body = addCommentSchema.parse(req.body);
    const historyEntry = await addRenewalComment({
      ...getContext(req),
      renewalId: params.id,
      ...body,
    });
    return res.status(201).json({ data: historyEntry });
  },
);

export const kanban = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const data = await getRenewalKanban(getContext(req));
    return res.status(200).json({ data });
  },
);
