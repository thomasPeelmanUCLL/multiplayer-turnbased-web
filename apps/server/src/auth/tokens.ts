// JWT helpers — issue and verify access tokens.
// Refresh token logic (rotation + revocation) lives in the auth routes.

import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const ACCESS_TOKEN_TTL = "15m";

export interface AccessTokenPayload {
  sub: string; // userId
}

export function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/**
 * Returns the payload when the token is valid, null otherwise.
 * Never throws — callers should treat null as "unauthenticated".
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
