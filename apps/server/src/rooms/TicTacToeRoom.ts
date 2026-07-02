// Colyseus room — handles only the multiplayer lifecycle.
// Game rules live in ../game/tictactoe.ts, not here.

import * as colyseus from 'colyseus';
import type { Client } from 'colyseus';

import type { ClientAction, Player } from '@repo/shared';
import { applyAction } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';
import { TicTacToeSchema } from './TicTacToeSchema.js';

export class TicTacToeRoom extends colyseus.Room<TicTacToeSchema> {
  maxClients = 2;

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

    const bothSeated = this.state.players.X !== '' && this.state.players.O !== '';
    if (bothSeated) {
      this.lock();
      this.state.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }
  }

  onLeave(client: Client) {
    logger.info({ roomId: this.roomId, sessionId: client.sessionId }, 'Player left');
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private handleAction(client: Client, action: ClientAction) {
    const player = this.getPlayerSymbol(client.sessionId);
    if (!player) {
      client.send('error', { message: 'You are not a player in this match' });
      return;
    }

    // Convert Schema state to plain object for pure game logic
    const plainState = {
      board: Array.from(this.state.board).map(c => c === '' ? null : c) as any,
      phase: this.state.phase as any,
      currentPlayer: this.state.currentPlayer as Player,
      winner: this.state.winner === '' ? null : this.state.winner as any,
      players: {
        X: this.state.players.X === '' ? null : this.state.players.X,
        O: this.state.players.O === '' ? null : this.state.players.O,
      },
    };

    const result = applyAction(plainState, player, action);

    if (!result.ok) {
      client.send('error', { message: result.error });
      logger.warn({ roomId: this.roomId, player, action, error: result.error }, 'Rejected action');
      return;
    }

    // Write result back into Schema
    const s = result.newState;
    for (let i = 0; i < 9; i++) {
      this.state.board[i] = s.board[i] ?? '';
    }
    this.state.phase         = s.phase;
    this.state.currentPlayer = s.currentPlayer;
    this.state.winner        = s.winner ?? '';

    if (this.state.phase === 'finished') {
      this.onMatchFinished();
    }
  }

  private assignSlot(sessionId: string): Player | null {
    if (this.state.players.X === '') {
      this.state.players.X = sessionId;
      return 'X';
    }
    if (this.state.players.O === '') {
      this.state.players.O = sessionId;
      return 'O';
    }
    return null;
  }

  private getPlayerSymbol(sessionId: string): Player | null {
    if (this.state.players.X === sessionId) return 'X';
    if (this.state.players.O === sessionId) return 'O';
    return null;
  }

  private onMatchFinished() {
    logger.info({ roomId: this.roomId, winner: this.state.winner }, 'Match finished');
    // Build a plain state for DB persistence
    const plainState = {
      board: Array.from(this.state.board).map(c => c === '' ? null : c) as any,
      phase: this.state.phase as any,
      currentPlayer: this.state.currentPlayer as Player,
      winner: this.state.winner === '' ? null : this.state.winner as any,
      players: {
        X: this.state.players.X || null,
        O: this.state.players.O || null,
      },
    };
    saveMatchResult(this.roomId, plainState).catch((err: unknown) => {
      logger.error({ roomId: this.roomId, err }, 'Failed to save match result');
    });
  }
}
