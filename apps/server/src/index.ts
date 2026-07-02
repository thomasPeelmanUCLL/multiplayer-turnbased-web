/**
 * Server entry point.
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

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', rateLimiters.auth, authRouter);
app.use('/matches', matchRouter);
app.use('/users', userRouter);

app.use(errorHandler);

const gameServer = new colyseus.Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// enableRealtimeListing lets joinOrCreate see rooms created milliseconds ago,
// preventing the race where two clients each spin up their own room.
gameServer.define('tictactoe', TicTacToeRoom)
  .enableRealtimeListing();

httpServer.listen(env.PORT, () => {
  console.log(`[server] listening on http://0.0.0.0:${env.PORT}`);
  console.log(`[server] environment: ${env.NODE_ENV}`);
});

pool.connect()
  .then((client) => {
    console.log('[db] connected');
    client.release();
  })
  .catch((err: unknown) => {
    console.error('[db] connection failed', err);
    process.exit(1);
  });
