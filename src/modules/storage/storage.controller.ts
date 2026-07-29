import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { presignUploadSchema } from "./storage.schemas.js";
import { createCloudinaryUploadSignature } from "./storage.service.js";

export const createPresignedUpload = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const parsed = presignUploadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({
          message: "Invalid presign payload",
          errors: parsed.error.flatten(),
        });
    }

    const payload = parsed.data;
    const signature = await createCloudinaryUploadSignature({
      folder: payload.folder,
      publicId: payload.publicId,
      resourceType: payload.resourceType,
      originalName: payload.originalName,
    });

    return res.status(200).json({
      message: "Presigned upload credentials generated",
      data: signature,
    });
  },
);
