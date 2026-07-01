// JWT helpers — issue and verify access tokens.
// Refresh token logic (rotation + revocation) lives in the auth routes.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ACCESS_TOKEN_TTL = env.JWT_ACCESS_EXPIRES_IN;

export interface AccessTokenPayload {
  sub: string; // userId
}

export function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/**
 * Returns the payload when the token is valid, null otherwise.
 * Never throws — callers should treat null as "unauthenticated".
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
