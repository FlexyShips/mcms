import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createPresignedUpload } from "./storage.controller.js";
import { presignUploadSchema } from "./storage.schemas.js";

const router = Router();

router.post(
  "/presign",
  authenticate,
  validate({ body: presignUploadSchema }),
  createPresignedUpload,
);

export default router;
