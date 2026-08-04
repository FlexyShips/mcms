import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { getFirstCookie } from '../utils/cookies.js';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'staging', 'localhost']);

function getHeaderValue(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function tenantSlugFromHost(host?: string): string | undefined {
  if (!host) return undefined;

  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  if (parts.length < 3) return undefined;

  const subdomain = parts[0]?.toLowerCase();

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return undefined;

  return subdomain;
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = getHeaderValue(req, 'x-tenant-id');
    const explicitSlug = getHeaderValue(req, 'x-tenant-slug') ?? getHeaderValue(req, 'x-subdomain');
    const cookieTenantId = getFirstCookie(req, ['tenantId', 'tenant_id']);
    const cookieSlug = getFirstCookie(req, ['tenantSlug', 'tenant_slug', 'subdomain']);
    const hostSlug = tenantSlugFromHost(req.headers.host);
    const bodySlug = typeof req.body?.slug === 'string' ? req.body.slug : undefined;
    const bodyTenantSlug =
      typeof req.body?.tenantSlug === 'string' ? req.body.tenantSlug : undefined;
    const slug = explicitSlug || cookieSlug || hostSlug || bodySlug || bodyTenantSlug;
    const resolvedTenantId = tenantId || cookieTenantId;

    if (!resolvedTenantId && !slug) {
      return next();
    }

    const tenant = await prisma.tenant.findFirst({
      where: resolvedTenantId ? { id: resolvedTenantId } : { slug },
    });

    if (!tenant) {
      return next(new HttpError(404, 'Tenant not found', 'TENANT_NOT_FOUND'));
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

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return next(new HttpError(400, 'Tenant context is required', 'TENANT_REQUIRED'));
  }

  next();
}
