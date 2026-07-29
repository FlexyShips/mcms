import type { TenantSettings } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
import { HttpError } from "../utils/httpError.js";

const TENANT_SETTINGS_TTL_SECONDS = 300;

export async function getTenantSettings(
  tenantId: string,
): Promise<TenantSettings> {
  const key = `tenant:settings:${tenantId}`;
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as TenantSettings;
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  if (!settings) {
    throw new HttpError(
      404,
      "Tenant settings not found",
      "TENANT_SETTINGS_NOT_FOUND",
    );
  }

  await redis.set(
    key,
    JSON.stringify(settings),
    "EX",
    TENANT_SETTINGS_TTL_SECONDS,
  );

  return settings;
}

export async function invalidateTenantSettingsCache(
  tenantId: string,
): Promise<void> {
  await redis.del(`tenant:settings:${tenantId}`);
}
