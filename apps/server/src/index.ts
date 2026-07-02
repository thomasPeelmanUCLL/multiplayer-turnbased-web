/**
 * Server entry point.
 */
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';

import { env } from './config/env.js';
import { pool } from './db/client.js';
import { authRouter } from './routes/auth.js';
import { matchRouter } from './routes/matches.js';
import { userRouter } from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiters } from './middleware/rateLimiters.js';
import { RoomManager } from './ws/RoomManager.js';
import { logger } from './lib/logger.js';

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth',    rateLimiters.auth, authRouter);
app.use('/matches', matchRouter);
app.use('/users',   userRouter);

app.use(errorHandler);

// WebSocket game server — mounted at /game
const wss = new WebSocketServer({ server: httpServer, path: '/game' });
const rooms = new RoomManager();
wss.on('connection', (socket) => rooms.handleConnection(socket));
logger.info('WebSocket server mounted at /game');

httpServer.listen(env.PORT, () => {
  logger.info(`listening on http://0.0.0.0:${env.PORT}`);
  logger.info(`environment: ${env.NODE_ENV}`);
});

pool.connect()
  .then((client) => {
    logger.info('db connected');
    client.release();
  })
  .catch((err: unknown) => {
    logger.error({ err }, 'db connection failed');
    process.exit(1);
  });
