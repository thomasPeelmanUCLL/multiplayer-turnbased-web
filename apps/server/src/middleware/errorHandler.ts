/**
 * Global Express error handler.
 *
 * Catches anything passed to next(err) and returns a consistent JSON shape.
 * In production, internal error details are hidden from the client.
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Zod validation errors → 422 with field-level detail
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      fields: err.flatten().fieldErrors,
    });
    return;
  }

  // Known application errors (e.g. 401, 403, 404)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Unknown errors — log on server, hide details from client in production
  console.error('[error]', err);
  const message = env.NODE_ENV === 'development' && err instanceof Error
    ? err.message
    : 'Internal server error';

  res.status(500).json({ error: message });
}
