import pino from "pino";
import pretty from "pino-pretty";
import { env } from "../config/env.js";

const stream = pretty({
  colorize: true,
  translateTime: "yyyy-mm-dd HH:MM:ss",
  ignore: "pid",
  hideObject: false,

  customPrettifiers: {
    req: (req) => {
      const r = req as {
        method: string;
        url: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        params?: Record<string, unknown>;
        headers?: { [key: string]: unknown };
        remoteAddress: string;
        remotePort: number;
        id: string;
        tenantId: string;
        userId: { id: string } | null;
        ip: string;
      };

      const query =
        r.query && Object.keys(r.query).length
          ? ` query=${JSON.stringify(r.query)}`
          : "";

      const body =
        r.body && Object.keys(r.body).length
          ? ` body=${JSON.stringify(r.body)}`
          : "";
      const params =
        r.params && Object.keys(r.params).length
          ? ` params=${JSON.stringify(r.params)}`
          : "";
      const headers =
        r.headers && Object.keys(r.headers).length
          ? ` host=${r?.headers?.host}`
          : "";

      return `${r.method} ${r.url}${query}${body}${params}${headers} from ${r.remoteAddress}:${r.remotePort} tenantId=${r.tenantId} userId=${r.userId?.id ?? "null"} ip=${r.ip} requestId=${r.id}`;
    },

    res: (res) => {
      const r = res as {
        statusCode: number;
        headers?: { [key: string]: unknown };
      };
      return `status=${r.statusCode}`;
    },
  },
});

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.passwordHash",
        "password",
        "passwordHash",
        "*.password",
        "*.token",
      ],
      remove: true,
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        tenantId: req.tenantId,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query,
        params: req.params,
        body: req.body,
      }),
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  },
  stream,
);
