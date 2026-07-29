import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { HttpError } from "../utils/httpError.js";
import {
  rolePermissions,
  type Permission,
} from "../permissions/permissions.js";

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new HttpError(401, "Authentication is required", "AUTH_REQUIRED"),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          "You do not have access to this resource",
          "FORBIDDEN",
        ),
      );
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new HttpError(401, "Authentication is required", "AUTH_REQUIRED"),
      );
    }

    const permissions = rolePermissions[req.user.role];

    if (!permissions.includes(permission)) {
      return next(
        new HttpError(
          403,
          `Missing permission: ${permission}`,
          "PERMISSION_DENIED",
        ),
      );
    }

    next();
  };
}

export const requireTenantAdmin = authorize("ADMIN");
