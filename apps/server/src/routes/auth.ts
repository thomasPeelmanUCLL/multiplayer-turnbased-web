/**
 * Authentication routes.
 *
 * POST /auth/register  — create a new account
 * POST /auth/login     — verify credentials, return token pair
 * POST /auth/refresh   — rotate refresh token, return new access token
 * POST /auth/logout    — revoke refresh token
 */
import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcrypt';
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
import { issueAccessToken } from '../auth/tokens.js';

export const authRouter: ReturnType<typeof Router> = Router();

const BCRYPT_ROUNDS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createRefreshToken(userId: string): Promise<string> {
  const token = randomUUID();
  const tokenHash = token; // for MVP: store raw UUID; add hashing later
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (env.JWT_REFRESH_EXPIRES_DAYS ?? 7));

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  return token;
}

// ── Register ──────────────────────────────────────────────────────────────────

const register: RequestHandler = async (req, res, next) => {
  try {
    const body = RegisterBodySchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({ username: body.username, passwordHash })
      .returning({ id: users.id, username: users.username });

    if (!user) throw new AppError(500, 'Failed to create user');

    const accessToken  = issueAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.status(201).json({ accessToken, refreshToken, username: user.username });
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return next(new AppError(409, 'Username already taken'));
    }
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

const login: RequestHandler = async (req, res, next) => {
  try {
    const body = LoginBodySchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.username, body.username),
    });

    const credentialsError = new AppError(401, 'Invalid username or password');
    if (!user) return next(credentialsError);

    const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordMatches) return next(credentialsError);

    const accessToken  = issueAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.json({ accessToken, refreshToken, username: user.username });
  } catch (err) {
    next(err);
  }
};

// ── Refresh ───────────────────────────────────────────────────────────────────

const refresh: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = RefreshBodySchema.parse(req.body);

    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, refreshToken),
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      }
      return next(new AppError(401, 'Invalid or expired refresh token'));
    }

    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const accessToken     = issueAccessToken(stored.userId);
    const newRefreshToken = await createRefreshToken(stored.userId);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

const logout: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = RefreshBodySchema.parse(req.body);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, refreshToken));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', requireAuth, logout);
