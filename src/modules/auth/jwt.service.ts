import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  SuperAdminAccessTokenPayload,
} from "./auth.types.js";

function getJwtSecret(kind: "access" | "refresh"): string {
  const secret =
    kind === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new HttpError(
      500,
      `JWT ${kind} secret is not configured`,
      "JWT_SECRET_MISSING",
    );
  }

  return secret;
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { ...payload, type: "access" },
    getJwtSecret("access"),
    options,
  );
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "type">,
): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { ...payload, type: "refresh" },
    getJwtSecret("refresh"),
    options,
  );
}

export function signSuperAdminAccessToken(
  payload: Omit<SuperAdminAccessTokenPayload, "type" | "scope">,
): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { ...payload, scope: "platform", type: "super_admin_access" },
    getJwtSecret("access"),
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      getJwtSecret("access"),
    ) as AccessTokenPayload;
    if (payload.type !== "access") {
      throw new HttpError(401, "Invalid access token", "INVALID_ACCESS_TOKEN");
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      401,
      "Invalid or expired access token",
      "INVALID_ACCESS_TOKEN",
    );
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      getJwtSecret("refresh"),
    ) as RefreshTokenPayload;

    if (payload.type !== "refresh") {
      throw new HttpError(
        401,
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN",
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      401,
      "Invalid or expired refresh token",
      "INVALID_REFRESH_TOKEN",
    );
  }
}

export function verifySuperAdminAccessToken(
  token: string,
): SuperAdminAccessTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      getJwtSecret("access"),
    ) as SuperAdminAccessTokenPayload;

    if (payload.type !== "super_admin_access" || payload.scope !== "platform") {
      throw new HttpError(
        401,
        "Invalid super admin token",
        "INVALID_SUPER_ADMIN_TOKEN",
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      401,
      "Invalid or expired super admin token",
      "INVALID_SUPER_ADMIN_TOKEN",
    );
  }
}
