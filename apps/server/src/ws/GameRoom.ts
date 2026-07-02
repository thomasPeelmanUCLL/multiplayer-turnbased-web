import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

import type { Player } from '@repo/shared';
import { applyAction, createInitialState } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';
import type { ServerMsg } from './protocol.js';

export interface ConnectedPlayer {
  sessionId: string;
  socket:    WebSocket;
  mark:      Player;
}

export class GameRoom {
  readonly roomId: string;
  private players: ConnectedPlayer[] = [];
  private gameState = createInitialState();

  constructor() {
    this.roomId = randomUUID().slice(0, 8);
  }

  get isFull()    { return this.players.length >= 2; }
  get isEmpty()   { return this.players.length === 0; }
  get playerCount() { return this.players.length; }

  addPlayer(socket: WebSocket): ConnectedPlayer {
    const mark: Player = this.players.length === 0 ? 'X' : 'O';
    const sessionId = randomUUID().slice(0, 12);

    this.gameState.players[mark] = sessionId;

    const p: ConnectedPlayer = { sessionId, socket, mark };
    this.players.push(p);

    logger.info({ roomId: this.roomId, sessionId, mark }, 'Player joined room');

    if (this.isFull) {
      this.gameState.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }

    this.broadcastState();
    return p;
  }

  removePlayer(sessionId: string) {
    this.players = this.players.filter(p => p.sessionId !== sessionId);
    logger.info({ roomId: this.roomId, sessionId }, 'Player left room');
  }

  handleAction(sessionId: string, action: { type: 'place_mark'; cell: number } | { type: 'resign' }) {
    const player = this.players.find(p => p.sessionId === sessionId);
    if (!player) return;

    const result = applyAction(this.gameState, player.mark, action);

    if (!result.ok) {
      this.send(player.socket, {
        type: 'error',
        payload: { message: result.error },
      });
      logger.warn({ roomId: this.roomId, sessionId, action, error: result.error }, 'Rejected action');
      return;
    }

    this.gameState = result.newState;
    this.broadcastState();

    if (this.gameState.phase === 'finished') {
      logger.info({ roomId: this.roomId, winner: this.gameState.winner }, 'Match finished');
      saveMatchResult(this.roomId, this.gameState).catch((err: unknown) => {
        logger.error({ roomId: this.roomId, err }, 'Failed to save match result');
      });
    }
  }

  private broadcastState() {
    for (const p of this.players) {
      this.send(p.socket, {
        type: 'state',
        payload: {
          roomId:        this.roomId,
          sessionId:     p.sessionId,
          board:         this.gameState.board,
          phase:         this.gameState.phase,
          currentPlayer: this.gameState.currentPlayer,
          winner:        this.gameState.winner,
          playerX:       this.gameState.players.X,
          playerO:       this.gameState.players.O,
        },
      });
    }
  }

  private send(socket: WebSocket, msg: ServerMsg) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
