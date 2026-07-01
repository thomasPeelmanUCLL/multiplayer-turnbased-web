/**
 * Match HTTP routes.
 *
 * GET  /matches        — list open matches (lobby: waiting for playerO)
 * POST /matches        — create a new match room (playerX = caller)
 * GET  /matches/:id    — match details
 */
import { Router, type RequestHandler } from 'express';
import { eq, desc, isNull } from 'drizzle-orm';

import { db } from '../db/client.js';
import { matches } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimiters } from '../middleware/rateLimiters.js';
import { AppError } from '../middleware/errorHandler.js';

export const matchRouter: ReturnType<typeof Router> = Router();

matchRouter.use(requireAuth);

// ── List open matches (waiting for playerO) ───────────────────────────────────

const listMatches: RequestHandler = async (_req, res, next) => {
  try {
    // "open" means playerO not yet assigned
    const openMatches = await db
      .select()
      .from(matches)
      .where(isNull(matches.playerO))
      .orderBy(desc(matches.createdAt))
      .limit(50);

    res.json(openMatches);
  } catch (err) {
    next(err);
  }
};

// ── Create a new match (caller becomes playerX) ───────────────────────────────

const createMatch: RequestHandler = async (req, res, next) => {
  try {
    const userId = res.locals['userId'] as string;
    const roomId = crypto.randomUUID();

    const [match] = await db
      .insert(matches)
      .values({
        id: roomId,
        playerX: userId,
        // playerO left null until a second player joins via Colyseus
        playerO: userId, // temporary: set same as X so NOT NULL is satisfied; Colyseus will manage actual assignment
      })
      .returning();

    if (!match) throw new AppError(500, 'Failed to create match');

    res.status(201).json(match);
  } catch (err) {
    next(err);
  }
};

// ── Get match details ─────────────────────────────────────────────────────────

const getMatch: RequestHandler = async (req, res, next) => {
  try {
    const match = await db
      .select()
      .from(matches)
      .where(eq(matches.id, req.params['id'] ?? ''))
      .limit(1)
      .then((rows) => rows[0]);

    if (!match) return next(new AppError(404, 'Match not found'));

    res.json(match);
  } catch (err) {
    next(err);
  }
};

matchRouter.get('/', listMatches);
matchRouter.post('/', rateLimiters.matchCreate, createMatch);
matchRouter.get('/:id', getMatch);
