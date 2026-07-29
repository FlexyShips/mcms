import type {
  TenantStatus,
  UserRole,
  Vessel,
} from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      tenantId?: string;
      tenant?: {
        id: string;
        slug: string;
        status: TenantStatus;
      };
      user?: {
        id: string;
        tenantId: string;
        role: UserRole;
        isOwner: boolean;
      };
      superAdmin?: {
        id: string;
        email: string;
      };
      vessel?: Vessel;
    }
  }
}

export {};
