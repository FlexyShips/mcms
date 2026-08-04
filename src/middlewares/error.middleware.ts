import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/httpError.js';
import { Prisma } from '../generated/prisma/client.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';
      const isEmailConflict = target.toLowerCase().includes('email');

      return res.status(409).json({
        error: {
          code: isEmailConflict ? 'EMAIL_EXISTS' : 'DUPLICATE_RESOURCE',
          message: isEmailConflict
            ? 'Email is already registered'
            : 'A record with these values already exists',
        },
      });
    }

    logger.error({ error, requestId: req.id }, 'Prisma request error');

    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
  }

  logger.error({ error, requestId: req.id }, 'Unhandled request error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
};
