import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { env } from './config/env.js';
import { pool } from './db/client.js';
import { authRouter } from './routes/auth.js';
import { matchRouter } from './routes/matches.js';
import { userRouter } from './routes/users.js';
import { TicTacToeRoom } from './rooms/TicTacToeRoom.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiters } from './middleware/rateLimiters.js';
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

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('tictactoe', TicTacToeRoom).enableRealtimeListing();
// gameServer.define('poker', PokerRoom).enableRealtimeListing();
// gameServer.define('uno',   UnoRoom).enableRealtimeListing();

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, `listening on http://0.0.0.0:${env.PORT}`);
  logger.info({ env: env.NODE_ENV }, `environment: ${env.NODE_ENV}`);
});

pool.connect()
  .then((client) => { logger.info({}, 'db connected'); client.release(); })
  .catch((err: unknown) => { logger.error({ err }, 'db connection failed'); process.exit(1); });
