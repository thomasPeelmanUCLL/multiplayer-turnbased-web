// JWT helpers — issue and verify access tokens.
// Refresh token logic (rotation + revocation) lives in the auth routes.

import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // userId
}

export function issueAccessToken(userId: string): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, options);
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
