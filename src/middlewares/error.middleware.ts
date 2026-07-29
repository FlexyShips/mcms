import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/httpError.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten()
      }
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  logger.error({ error, requestId: req.id }, 'Unhandled request error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    }
  });
};
