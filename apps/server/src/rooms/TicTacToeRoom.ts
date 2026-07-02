// Colyseus room — handles only the multiplayer lifecycle.
// Game rules live in ../game/tictactoe.ts, not here.

import * as colyseus from 'colyseus';
import type { Client } from 'colyseus';

import type { ClientAction, Player, TicTacToeState } from '@repo/shared';
import { applyAction, createInitialState } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';

export class TicTacToeRoom extends colyseus.Room<TicTacToeState> {
  maxClients = 2;

  onCreate() {
    this.setState(createInitialState());

    // Auto-dispose room if no one joins within 30 s
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

    // Lock the room once both seats are filled so joinOrCreate
    // never sends a third client here
    const bothSeated = this.state.players.X && this.state.players.O;
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

    const result = applyAction(this.state, player, action);

    if (!result.ok) {
      client.send('error', { message: result.error });
      logger.warn(
        { roomId: this.roomId, player, action, error: result.error },
        'Rejected action',
      );
      return;
    }

    Object.assign(this.state, result.newState);

    if (this.state.phase === 'finished') {
      this.onMatchFinished();
    }
  }

  private assignSlot(sessionId: string): Player | null {
    if (!this.state.players.X) {
      this.state.players.X = sessionId;
      return 'X';
    }
    if (!this.state.players.O) {
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
    logger.info(
      { roomId: this.roomId, winner: this.state.winner },
      'Match finished',
    );
    saveMatchResult(this.roomId, this.state).catch((err: unknown) => {
      logger.error({ roomId: this.roomId, err }, 'Failed to save match result');
    });
  }
}
