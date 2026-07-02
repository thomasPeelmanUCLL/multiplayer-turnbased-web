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

    const bothSeated = this.state.playerX !== '' && this.state.playerO !== '';
    if (bothSeated) {
      this.lock();
      this.state.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }

    // Broadcast plain JSON state so all clients get current playerX/playerO
    this.broadcastState();
  }

  onLeave(client: Client) {
    logger.info({ roomId: this.roomId, sessionId: client.sessionId }, 'Player left');
  }

  private broadcastState() {
    const msg = this.getStatePlain();
    this.broadcast('state', msg);
  }

  private getStatePlain() {
    return {
      board: Array.from(this.state.board).map(c => c === '' ? null : c),
      phase: this.state.phase,
      currentPlayer: this.state.currentPlayer,
      winner: this.state.winner === '' ? null : this.state.winner,
      playerX: this.state.playerX === '' ? null : this.state.playerX,
      playerO: this.state.playerO === '' ? null : this.state.playerO,
    };
  }

  private handleAction(client: Client, action: ClientAction) {
    const player = this.getPlayerSymbol(client.sessionId);
    if (!player) {
      client.send('error', { message: 'You are not a player in this match' });
      return;
    }

    const plain = this.getStatePlain();
    const result = applyAction({
      board: plain.board as any,
      phase: plain.phase as any,
      currentPlayer: plain.currentPlayer as Player,
      winner: plain.winner as any,
      players: { X: plain.playerX, O: plain.playerO },
    }, player, action);

    if (!result.ok) {
      client.send('error', { message: result.error });
      logger.warn({ roomId: this.roomId, player, action, error: result.error }, 'Rejected action');
      return;
    }

    const s = result.newState;
    for (let i = 0; i < 9; i++) this.state.board[i] = s.board[i] ?? '';
    this.state.phase         = s.phase;
    this.state.currentPlayer = s.currentPlayer;
    this.state.winner        = s.winner ?? '';

    this.broadcastState();

    if (this.state.phase === 'finished') this.onMatchFinished();
  }

  private assignSlot(sessionId: string): Player | null {
    if (this.state.playerX === '') { this.state.playerX = sessionId; return 'X'; }
    if (this.state.playerO === '') { this.state.playerO = sessionId; return 'O'; }
    return null;
  }

  private getPlayerSymbol(sessionId: string): Player | null {
    if (this.state.playerX === sessionId) return 'X';
    if (this.state.playerO === sessionId) return 'O';
    return null;
  }

  private onMatchFinished() {
    logger.info({ roomId: this.roomId, winner: this.state.winner }, 'Match finished');
    const plain = this.getStatePlain();
    saveMatchResult(this.roomId, {
      board: plain.board as any,
      phase: plain.phase as any,
      currentPlayer: plain.currentPlayer as Player,
      winner: plain.winner as any,
      players: { X: plain.playerX, O: plain.playerO },
    }).catch((err: unknown) => {
      logger.error({ roomId: this.roomId, err }, 'Failed to save match result');
    });
  }
}
