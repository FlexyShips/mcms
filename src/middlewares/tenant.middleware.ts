import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "staging",
  "localhost",
]);

function getHeaderValue(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function tenantSlugFromHost(host?: string): string | undefined {
  if (!host) return undefined;

  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  if (parts.length < 3) return undefined;

  const subdomain = parts[0]?.toLowerCase();

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return undefined;

  return subdomain;
}

export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const tenantId = getHeaderValue(req, "x-tenant-id");
    const explicitSlug =
      getHeaderValue(req, "x-tenant-slug") ??
      getHeaderValue(req, "x-subdomain");
    const hostSlug = tenantSlugFromHost(req.headers.host);
    const testSlug = tenantSlugFromHost(req.body.slug);
    const slug = explicitSlug || hostSlug || testSlug;

    if (!tenantId && !slug) {
      return next();
    }

    const tenant = await prisma.tenant.findFirst({
      where: tenantId ? { id: tenantId } : { slug },
    });

    if (!tenant) {
      return next(new HttpError(404, "Tenant not found", "TENANT_NOT_FOUND"));
    }

    req.tenantId = tenant.id;
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.tenantId) {
    return next(
      new HttpError(400, "Tenant context is required", "TENANT_REQUIRED"),
    );
  }

  next();
}
