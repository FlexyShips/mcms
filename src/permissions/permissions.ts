import type { UserRole } from "../generated/prisma/client.js";

export const permissions = [
  "billing:manage",
  "users:manage",
  "settings:manage",
  "fleet:read",
  "vessels:read",
  "vessels:write",
  "crew:read",
  "crew:write",
  "certificates:read",
  "certificates:write",
  "documents:read",
  "documents:write",
  "renewals:read",
  "renewals:write",
  "reports:read",
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: [...permissions],
  FLEET_MANAGER: [
    "fleet:read",
    "vessels:read",
    "vessels:write",
    "crew:read",
    "certificates:read",
    "certificates:write",
    "documents:read",
    "documents:write",
    "renewals:read",
    "renewals:write",
    "reports:read",
  ],
  MARINE_SUPERINTENDENT: [
    "fleet:read",
    "vessels:read",
    "certificates:read",
    "certificates:write",
    "documents:read",
    "documents:write",
    "renewals:read",
    "renewals:write",
    "reports:read",
  ],
  HR_MANAGER: [
    "crew:read",
    "crew:write",
    "certificates:read",
    "certificates:write",
    "documents:read",
    "documents:write",
    "renewals:read",
    "renewals:write",
    "reports:read",
  ],
  CREW_MEMBER: ["crew:read", "certificates:read", "documents:read"],
};
