/**
 * Server entry point.
 *
 * Boots Express + Colyseus on a single HTTP server.
 * Load order:
 *   1. Environment validation
 *   2. Database connection
 *   3. Express middleware
 *   4. HTTP routes
 *   5. Colyseus rooms
 *   6. Start listening
 */
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as colyseus from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { env } from './config/env.js';
import { pool } from './db/client.js';
import { authRouter } from './routes/auth.js';
import { matchRouter } from './routes/matches.js';
import { userRouter } from './routes/users.js';
import { TicTacToeRoom } from './rooms/TicTacToeRoom.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiters } from './middleware/rateLimiters.js';

const app = express();
const httpServer = createServer(app);

// ── Security & parsing ─────────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));

// ── Health check (no auth required) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── HTTP routes ───────────────────────────────────────────────────────────────────────────
app.use('/auth', rateLimiters.auth, authRouter);
app.use('/matches', matchRouter);
app.use('/users', userRouter);

// ── Global error handler (must be last Express middleware) ────────────────────────────
app.use(errorHandler);

// ── Colyseus game rooms ───────────────────────────────────────────────────────────────────
const gameServer = new colyseus.Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
gameServer.define('tictactoe', TicTacToeRoom);

// ── Boot ──────────────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT}`);
  console.log(`[server] environment: ${env.NODE_ENV}`);
});

// Verify DB connection on startup so we fail fast rather than at first query
pool.connect()
  .then((client) => {
    console.log('[db] connected');
    client.release();
  })
  .catch((err: unknown) => {
    console.error('[db] connection failed', err);
    process.exit(1);
  });
