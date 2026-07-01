/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header and attaches
 * the authenticated user's ID to res.locals.userId.
 *
 * Usage:
 *   router.get('/me', requireAuth, (req, res) => { ... })
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

/** Shape of the payload we sign into access tokens */
export type AccessTokenPayload = {
  sub: string; // user UUID
  type: 'access';
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or malformed Authorization header'));
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

    if (payload.type !== 'access') {
      return next(new AppError(401, 'Invalid token type'));
    }

    // Attach user ID so downstream handlers never read it from request body
    res.locals['userId'] = payload.sub;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired access token'));
  }
}
