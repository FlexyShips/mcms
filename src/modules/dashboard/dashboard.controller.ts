import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";

export async function summary(req: Request, res: Response) {
  const summary = await dashboardService.getDashboardSummary(
    req.tenantId!,
    req.user!,
  );
  res.json(summary);
}
