/**
 * User routes.
 *
 * GET /users/me    — own profile (requires auth)
 * GET /users/:id   — public profile
 */
import { Router, type RequestHandler } from 'express';
import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { AppError } from '../middleware/errorHandler.js';

export const userRouter: ReturnType<typeof Router> = Router();

/** Fields safe to expose publicly */
const publicFields = {
  id:        users.id,
  username:  users.username,
  createdAt: users.createdAt,
};

const getMe: RequestHandler = async (_req, res, next) => {
  try {
    const userId = res.locals['userId'] as string;

    const user = await db
      .select(publicFields)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) return next(new AppError(404, 'User not found'));

    res.json(user);
  } catch (err) {
    next(err);
  }
};

const getUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await db
      .select(publicFields)
      .from(users)
      .where(eq(users.id, req.params['id'] ?? ''))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) return next(new AppError(404, 'User not found'));

    res.json(user);
  } catch (err) {
    next(err);
  }
};

userRouter.get('/me', requireAuth, getMe);
userRouter.get('/:id', requireAuth, getUser);
