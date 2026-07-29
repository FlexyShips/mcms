import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

const tenantOwnedModels = new Set([
  "TenantSettings",
  "User",
  "Vessel",
  "Certificate",
  "Document",
  "DocumentEmbedding",
  "CrewMember",
  "RenewalItem",
  "NotificationLog",
  "AiInteraction",
  "ApiKey",
  "WebhookEndpoint",
]);

const tenantWriteOperations = new Set([
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

function mergeTenantWhere(args: Record<string, unknown>, tenantId: string) {
  return {
    ...args,
    where: {
      ...((args.where as Record<string, unknown> | undefined) ?? {}),
      tenantId,
    },
  };
}

function mergeTenantCreateData(
  args: Record<string, unknown>,
  tenantId: string,
) {
  const data = args.data;

  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((item) => ({ ...item, tenantId })),
    };
  }

  if (data && typeof data === "object") {
    return {
      ...args,
      data: {
        ...(data as Record<string, unknown>),
        tenantId,
      },
    };
  }

  return args;
}

function scopeArgs<T>(args: T, operation: string, tenantId: string): T {
  if (!args || typeof args !== "object") return args;

  let scopedArgs = args as Record<string, unknown>;

  if (
    tenantWriteOperations.has(operation) ||
    operation.startsWith("find") ||
    operation === "count" ||
    operation === "aggregate"
  ) {
    scopedArgs = mergeTenantWhere(scopedArgs, tenantId);
  }

  if (operation === "create" || operation === "createMany") {
    scopedArgs = mergeTenantCreateData(scopedArgs, tenantId);
  }

  if (operation === "upsert") {
    scopedArgs = {
      ...scopedArgs,
      create: {
        ...((scopedArgs.create as Record<string, unknown> | undefined) ?? {}),
        tenantId,
      },
    };
  }

  return scopedArgs as T;
}

export function prismaForTenant(tenantId: string) {
  return prisma.$extends(
    Prisma.defineExtension({
      name: "tenant-scope",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !tenantOwnedModels.has(model)) {
              return query(args);
            }

            return query(scopeArgs(args, operation, tenantId));
          },
        },
      },
    }),
  );
}
