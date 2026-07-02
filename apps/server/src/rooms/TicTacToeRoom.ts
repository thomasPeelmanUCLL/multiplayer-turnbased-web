import type { Client } from 'colyseus';
import type { TicTacToeState, Player } from '@repo/shared';
import { ClientActionSchema } from '@repo/shared';
import { applyAction, createInitialState } from '../game/tictactoe.js';
import { saveMatchResult } from '../db/matches.js';
import { logger } from '../lib/logger.js';
import { BaseRoom, type ActionMessage } from './BaseRoom.js';

interface TicTacToePlain {
  board:         TicTacToeState['board'];
  phase:         TicTacToeState['phase'];
  currentPlayer: TicTacToeState['currentPlayer'];
  winner:        TicTacToeState['winner'];
  playerX:       string | null;
  playerO:       string | null;
}

export class TicTacToeRoom extends BaseRoom {
  maxClients = 2;
  private gameState: TicTacToeState = createInitialState();

  protected getStatePlain(): TicTacToePlain {
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

    // Validate the payload with Zod before touching game logic
    const parsed = ClientActionSchema.safeParse(action);
    if (!parsed.success) {
      this.sendError(client, `Invalid action: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
      logger.warn({ roomId: this.roomId, player, action }, 'Invalid action payload');
      return;
    }

    const result = applyAction(this.gameState, player, parsed.data);

    if (!result.ok) {
      this.sendError(client, result.error);
      logger.warn({ roomId: this.roomId, player, action: parsed.data, error: result.error }, 'Rejected action');
      return;
    }

    this.gameState = result.newState;
    this.broadcastState();

    if (this.gameState.phase === 'finished') this.onMatchFinished();
  }

  onJoin(client: Client) {
    const mark = this.assignMark(client.sessionId);
    if (!mark) { client.leave(); return; }

    if (this.gameState.players.X !== null && this.gameState.players.O !== null) {
      void this.lock();
      this.gameState.phase = 'active';
      logger.info({ roomId: this.roomId }, 'Match started');
    }

    super.onJoin(client);
  }

  private assignMark(sessionId: string): Player | null {
    if (this.gameState.players.X === null) { this.gameState.players.X = sessionId; return 'X'; }
    if (this.gameState.players.O === null) { this.gameState.players.O = sessionId; return 'O'; }
    return null;
  }

  private getPlayerMark(sessionId: string): Player | null {
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
