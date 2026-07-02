import * as colyseus from 'colyseus';
import type { Client } from 'colyseus';

import type { Board, ClientAction, Player, TicTacToeState } from '@repo/shared';
import { applyAction, createInitialState } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';
import { TicTacToeSchema } from './TicTacToeSchema.js';

export class TicTacToeRoom extends colyseus.Room<TicTacToeSchema> {
  maxClients = 2;

  // Authoritative state as plain JS — avoids ArraySchema mutation bugs
  private gameState: TicTacToeState = createInitialState();

  onCreate() {
    this.setState(new TicTacToeSchema());
    this.autoDispose = true;

    this.onMessage<ClientAction>('action', (client, action) => {
      this.handleAction(client, action);
    });

    logger.info({ roomId: this.roomId }, 'TicTacToeRoom created');
  }

  onJoin(client: Client) {
    const slot = this.assignSlot(client.sessionId);
    if (!slot) {
      client.leave();
      return;
    }

    logger.info({ roomId: this.roomId, sessionId: client.sessionId, slot }, 'Player joined');

    const bothSeated =
      this.gameState.players.X !== null && this.gameState.players.O !== null;

    if (bothSeated) {
      this.lock();
      this.gameState.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }

    this.broadcastState();
  }

  onLeave(client: Client) {
    logger.info({ roomId: this.roomId, sessionId: client.sessionId }, 'Player left');
  }

  private broadcastState() {
    this.broadcast('state', {
      board:         this.gameState.board,
      phase:         this.gameState.phase,
      currentPlayer: this.gameState.currentPlayer,
      winner:        this.gameState.winner,
      playerX:       this.gameState.players.X,
      playerO:       this.gameState.players.O,
    });
  }

  private handleAction(client: Client, action: ClientAction) {
    const player = this.getPlayerSymbol(client.sessionId);
    if (!player) {
      client.send('error', { message: 'You are not a player in this match' });
      return;
    }

    const result = applyAction(this.gameState, player, action);

    if (!result.ok) {
      client.send('error', { message: result.error });
      logger.warn({ roomId: this.roomId, player, action, error: result.error }, 'Rejected action');
      return;
    }

    this.gameState = result.newState;
    this.broadcastState();

    if (this.gameState.phase === 'finished') this.onMatchFinished();
  }

  private assignSlot(sessionId: string): Player | null {
    if (this.gameState.players.X === null) {
      this.gameState.players.X = sessionId;
      return 'X';
    }
    if (this.gameState.players.O === null) {
      this.gameState.players.O = sessionId;
      return 'O';
    }
    return null;
  }

  private getPlayerSymbol(sessionId: string): Player | null {
    if (this.gameState.players.X === sessionId) return 'X';
    if (this.gameState.players.O === sessionId) return 'O';
    return null;
  }

  private onMatchFinished() {
    logger.info({ roomId: this.roomId, winner: this.gameState.winner }, 'Match finished');
    saveMatchResult(this.roomId, this.gameState).catch((err: unknown) => {
      logger.error({ roomId: this.roomId, err }, 'Failed to save match result');
    });
  }
}
