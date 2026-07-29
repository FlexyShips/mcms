import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { API_PREFIX } from "./config/constants.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { publicLimiter } from "./middlewares/rateLimiter.middleware.js";
import { resolveTenant } from "./middlewares/tenant.middleware.js";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { subscriptionRouter } from "./modules/subscription/subscription.routes.js";
import {
  waitlistRouter,
  adminWaitlistRouter,
} from "./modules/waitlist/waitlist.routes.js";
import { userRouter } from "./modules/user/user.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { vesselRouter } from "./modules/vessel/vessel.routes.js";
import { crewRouter } from "./modules/crew/crew.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import storageRouter from "./modules/storage/storage.routes.js";
import certificateRouter from "./modules/certificate/certificate.routes.js";
import renewalRouter from "./modules/renewal/renewal.routes.js";
import notificationRouter from "./modules/notification/notification.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { HttpError } from "./utils/httpError.js";
import { swaggerDocument } from "./swagger.js";
import { pinoHttp } from "pino-http";
import { signupRouter } from "./modules/signup/signup.routes.js";
import { webhookRouter } from "./modules/webhooks/webhook.routes.js";
import { planRouter } from "./modules/plan/plan.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: express.Request) =>
        req.headers["x-request-id"]?.toString() ?? randomUUID(),
    }),
  );
  app.use(publicLimiter);
  app.use(
    `${API_PREFIX}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument),
  );

  app.use(`${API_PREFIX}/plan`, planRouter);
  app.use(`${API_PREFIX}/signup`, signupRouter);
  app.use(`${API_PREFIX}/admin`, adminRouter);
  app.use(`${API_PREFIX}/webhook`, webhookRouter);

  app.use(resolveTenant);
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/waitlist`, waitlistRouter);
  app.use(`${API_PREFIX}/waitlist/admin`, adminWaitlistRouter);
  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/subscriptions`, subscriptionRouter);
  app.use(`${API_PREFIX}/users`, userRouter);
  app.use(`${API_PREFIX}/vessels`, vesselRouter);
  app.use(`${API_PREFIX}/crew`, crewRouter);
  app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
  app.use(`${API_PREFIX}/storage`, storageRouter);
  app.use(`${API_PREFIX}`, certificateRouter);
  app.use(`${API_PREFIX}/renewals`, renewalRouter);
  app.use(`${API_PREFIX}/notifications`, notificationRouter);
  app.use(`${API_PREFIX}/subscription`, subscriptionRouter);

  app.get(`${API_PREFIX}/openapi.json`, (_req, res) =>
    res.json(swaggerDocument),
  );

  app.use((req, _res, next) => {
    next(
      new HttpError(
        404,
        `Route not found: ${req.method} ${req.originalUrl}`,
        "ROUTE_NOT_FOUND",
      ),
    );
  });

  app.use(errorHandler);

  return app;
}
