import { z } from "zod";

export const presignUploadSchema = z.object({
  folder: z.string().max(200).optional(),
  publicId: z.string().max(200).optional(),
  resourceType: z.enum(["image", "raw", "video"]).default("raw"),
  originalName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
});
