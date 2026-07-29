import crypto from "node:crypto";
import { env } from "../../config/env.js";

const cloudName = env.CLOUDINARY_CLOUD_NAME || "";
const apiKey = env.CLOUDINARY_API_KEY || "";
const apiSecret = env.CLOUDINARY_API_SECRET || "";

export interface PresignUploadResult {
  signature: string;
  timestamp: string;
  apiKey: string;
  cloudName: string;
  uploadUrl: string;
  publicId: string;
  folder: string;
  resourceType: "image" | "raw" | "video";
}

function buildPublicId(
  folder: string,
  originalName: string,
  resourceType: "image" | "raw" | "video",
) {
  const safeName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const ext = safeName.includes(".")
    ? safeName.split(".").pop()
    : resourceType === "image"
      ? "jpg"
      : "bin";
  const base = safeName.replace(/\.[^.]+$/, "") || "upload";

  return `${folder}/${base}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
}

export async function createCloudinaryUploadSignature(input: {
  folder?: string;
  publicId?: string;
  resourceType?: "image" | "raw" | "video";
  originalName?: string;
}): Promise<PresignUploadResult> {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are not configured");
  }

  const folder = input.folder || "uploads";
  const resourceType = input.resourceType || "raw";
  const publicId =
    input.publicId ||
    buildPublicId(folder, input.originalName || "file", resourceType);
  const timestamp = String(Math.floor(Date.now() / 1000));

  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
    resource_type: resourceType,
    overwrite: "true",
  };

  const params = new URLSearchParams(
    paramsToSign as Record<string, string>,
  ).toString();
  const signature = crypto
    .createHash("sha256")
    .update(params + apiSecret)
    .digest("hex");

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    publicId,
    folder,
    resourceType,
  };
}
