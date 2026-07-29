import { UserRole } from "../../generated/prisma/enums.js";

export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  role: UserRole;
  isOwner: boolean;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  tenantId: string;
  tokenId: string;
  type: "refresh";
};

export type SuperAdminAccessTokenPayload = {
  sub: string;
  scope: "platform";
  type: "super_admin_access";
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
