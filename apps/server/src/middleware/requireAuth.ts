// Express middleware — verifies a Bearer access token on protected routes.
// On success it attaches userId to res.locals so route handlers can use it.

import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/tokens.js";
export type { AccessTokenPayload } from "../auth/tokens.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.locals["userId"] = payload.sub;
  next();
}
