/**
 * Authentication routes.
 *
 * POST /auth/register  — create a new account
 * POST /auth/login     — verify credentials, return token pair
 * POST /auth/refresh   — rotate refresh token, return new access token
 * POST /auth/logout    — revoke refresh token
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import {
  RegisterBodySchema,
  LoginBodySchema,
  RefreshBodySchema,
} from '@repo/shared';

import { db } from '../db/client.js';
import { users, refreshTokens } from '../db/schema.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { AccessTokenPayload } from '../middleware/requireAuth.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  await db.insert(refreshTokens).values({ userId, token, expiresAt });
  return token;
}

// ── Register ──────────────────────────────────────────────────────────────────

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = RegisterBodySchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({ username: body.username, email: body.email, password: passwordHash })
      .returning({ id: users.id, username: users.username });

    if (!user) throw new AppError(500, 'Failed to create user');

    const accessToken  = signAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.status(201).json({ accessToken, refreshToken, username: user.username });
  } catch (err) {
    // Unique constraint violation — username or email already taken
    if (err instanceof Error && err.message.includes('unique')) {
      return next(new AppError(409, 'Username or email already taken'));
    }
    next(err);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = LoginBodySchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    // Use a generic message to avoid user enumeration
    const credentialsError = new AppError(401, 'Invalid email or password');

    if (!user) return next(credentialsError);

    const passwordMatches = await bcrypt.compare(body.password, user.password);
    if (!passwordMatches) return next(credentialsError);

    const accessToken  = signAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.json({ accessToken, refreshToken, username: user.username });
  } catch (err) {
    next(err);
  }
});

// ── Refresh ───────────────────────────────────────────────────────────────────

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = RefreshBodySchema.parse(req.body);

    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Expired or unknown token — revoke it if it still exists
      if (stored) {
        await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      }
      return next(new AppError(401, 'Invalid or expired refresh token'));
    }

    // Rotate: delete old token, issue new pair
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const accessToken    = signAccessToken(stored.userId);
    const newRefreshToken = await createRefreshToken(stored.userId);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = RefreshBodySchema.parse(req.body);

    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
