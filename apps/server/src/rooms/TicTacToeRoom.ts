import type { Client } from 'colyseus';
import type { TicTacToeState } from '@repo/shared';
import { applyAction, createInitialState } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';
import { BaseRoom, type ActionMessage } from './BaseRoom.js';

export class TicTacToeRoom extends BaseRoom<ReturnType<TicTacToeRoom['getStatePlain']>> {
  maxClients = 2;

  private gameState: TicTacToeState = createInitialState();

  // -------------------------------------------------------------------------
  // BaseRoom contract
  // -------------------------------------------------------------------------

  protected getStatePlain() {
    return {
      board:         this.gameState.board,
      phase:         this.gameState.phase,
      currentPlayer: this.gameState.currentPlayer,
      winner:        this.gameState.winner,
      playerX:       this.gameState.players.X,
      playerO:       this.gameState.players.O,
    };
  }

  protected handleAction(client: Client, action: ActionMessage) {
    const player = this.getPlayerMark(client.sessionId);
    if (!player) {
      this.sendError(client, 'You are not a player in this match');
      return;
    }

    const result = applyAction(this.gameState, player, action as Parameters<typeof applyAction>[2]);

    if (!result.ok) {
      this.sendError(client, result.error);
      logger.warn({ roomId: this.roomId, player, action, error: result.error }, 'Rejected action');
      return;
    }

    this.gameState = result.newState;
    this.broadcastState();

    if (this.gameState.phase === 'finished') this.onMatchFinished();
  }

  // -------------------------------------------------------------------------
  // Lifecycle overrides
  // -------------------------------------------------------------------------

  onJoin(client: Client) {
    const mark = this.assignMark(client.sessionId);
    if (!mark) {
      client.leave();
      return;
    }

    const bothSeated = this.gameState.players.X !== null && this.gameState.players.O !== null;
    if (bothSeated) {
      this.lock();
      this.gameState.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }

    super.onJoin(client); // logs + broadcastState
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private assignMark(sessionId: string): 'X' | 'O' | null {
    if (this.gameState.players.X === null) { this.gameState.players.X = sessionId; return 'X'; }
    if (this.gameState.players.O === null) { this.gameState.players.O = sessionId; return 'O'; }
    return null;
  }

  private getPlayerMark(sessionId: string): 'X' | 'O' | null {
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
