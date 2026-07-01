/**
 * Match HTTP routes.
 *
 * GET  /matches        — list open matches (lobby)
 * POST /matches        — create a new match room
 * GET  /matches/:id    — match details
 */
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';

import { CreateMatchBodySchema } from '@repo/shared';

import { db } from '../db/client.js';
import { matches, matchPlayers } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimiters } from '../middleware/rateLimiters.js';
import { AppError } from '../middleware/errorHandler.js';

export const matchRouter = Router();

// All match routes require a valid JWT
matchRouter.use(requireAuth);

// ── List open matches ─────────────────────────────────────────────────────────

matchRouter.get('/', async (_req, res, next) => {
  try {
    const openMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.status, 'waiting'))
      .orderBy(desc(matches.createdAt))
      .limit(50);

    res.json(openMatches);
  } catch (err) {
    next(err);
  }
});

// ── Create a new match ────────────────────────────────────────────────────────

matchRouter.post(
  '/',
  rateLimiters.matchCreate,
  async (_req, res, next) => {
    try {
      const userId = res.locals['userId'] as string;
      const body   = CreateMatchBodySchema.parse(_req.body);

      const [match] = await db
        .insert(matches)
        .values({ gameType: body.gameType })
        .returning();

      if (!match) throw new AppError(500, 'Failed to create match');

      // The creator takes seat 0 (goes first)
      await db.insert(matchPlayers).values({
        matchId: match.id,
        userId,
        seat: 0,
      });

      res.status(201).json(match);
    } catch (err) {
      next(err);
    }
  },
);

// ── Get match details ─────────────────────────────────────────────────────────

matchRouter.get('/:id', async (req, res, next) => {
  try {
    const match = await db
      .select()
      .from(matches)
      .where(eq(matches.id, req.params['id'] ?? ''))
      .limit(1)
      .then((rows) => rows[0]);

    if (!match) return next(new AppError(404, 'Match not found'));

    const players = await db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, match.id));

    res.json({ ...match, players });
  } catch (err) {
    next(err);
  }
});
