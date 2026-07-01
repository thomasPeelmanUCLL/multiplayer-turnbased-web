/**
 * TicTacToeRoom — Colyseus room for a 2-player tic-tac-toe match.
 *
 * Responsibilities:
 *   - Accept exactly 2 authenticated players.
 *   - Maintain authoritative board state.
 *   - Validate every action before applying it.
 *   - Persist the turn event log and match result to the database.
 *   - Broadcast state patches to all clients automatically via Colyseus.
 */
import { Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';
import { eq } from 'drizzle-orm';

import { ClientActionSchema } from '@repo/shared';
import type { Mark } from '@repo/shared';

import { db } from '../db/client.js';
import { matches, matchPlayers, turnEvents } from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';

// ── Colyseus state schema ─────────────────────────────────────────────────────

class PlayerState extends Schema {
  @type('string') userId:    string = '';
  @type('string') username:  string = '';
  @type('string') mark:      string = ''; // 'X' | 'O'
  @type('boolean') connected: boolean = true;
}

class TicTacToeState extends Schema {
  @type('string')  phase:           string = 'waiting'; // waiting|active|finished
  @type('string')  currentPlayerId: string = '';
  @type('number')  turnNumber:      number = 0;
  /** 9-cell board encoded as a comma-separated string: 'X,,O,,X,,,,O' */
  @type('string')  board:           string = ',,,,,,,,';
  @type('string')  winnerId:        string = ''; // '' = no winner yet / draw
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

// ── Win condition ─────────────────────────────────────────────────────────────

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

function checkWinner(board: (Mark | null)[]): Mark | 'draw' | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Mark;
    }
  }
  // Draw when all cells are filled and no winner
  if (board.every((cell) => cell !== null)) return 'draw';
  return null;
}

function decodeBoard(encoded: string): (Mark | null)[] {
  return encoded.split(',').map((v) => (v === '' ? null : (v as Mark)));
}

function encodeBoard(board: (Mark | null)[]): string {
  return board.map((v) => v ?? '').join(',');
}

// ── Room ──────────────────────────────────────────────────────────────────────

/** Options passed when joining/creating the room */
type RoomOptions = { matchId: string; userId: string; username: string };

export class TicTacToeRoom extends Room<TicTacToeState> {
  maxClients = 2;

  /** Map from sessionId → userId (populated on join, never from client payload) */
  private sessionToUser = new Map<string, string>();

  onCreate(): void {
    this.setState(new TicTacToeState());

    // Keep the room alive across reconnects while the match is active
    this.autoDispose = false;

    this.onMessage('*', (client, type, message) => {
      this.handleAction(client, type as string, message).catch((err: unknown) => {
        console.error('[room] unhandled action error', err);
      });
    });
  }

  async onJoin(client: Client, options: RoomOptions): Promise<void> {
    const { matchId, userId, username } = options;

    if (!matchId || !userId || !username) {
      throw new Error('matchId, userId and username are required to join');
    }

    this.sessionToUser.set(client.sessionId, userId);

    // Assign marks: first joiner = X, second = O
    const mark: Mark = this.state.players.size === 0 ? 'X' : 'O';
    const player = new PlayerState();
    player.userId    = userId;
    player.username  = username;
    player.mark      = mark;
    player.connected = true;
    this.state.players.set(userId, player);

    console.log(`[room] ${username} joined as ${mark}`);

    // Start the match once both seats are filled
    if (this.clients.length === 2) {
      await this.startMatch(matchId);
    }
  }

  onLeave(client: Client, consented: boolean): void {
    const userId = this.sessionToUser.get(client.sessionId);
    if (!userId) return;

    const player = this.state.players.get(userId);
    if (player) player.connected = false;

    if (consented) {
      // Intentional disconnect — treated as surrender
      this.handleSurrender(userId).catch(console.error);
    }
    // Unexpected disconnect: room stays alive, player can reconnect
  }

  onDispose(): void {
    console.log('[room] disposed');
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async startMatch(matchId: string): Promise<void> {
    // Set the first player (mark X) as the starting player
    let firstPlayerId = '';
    this.state.players.forEach((p) => {
      if (p.mark === 'X') firstPlayerId = p.userId;
    });

    this.state.phase           = 'active';
    this.state.currentPlayerId = firstPlayerId;

    await db
      .update(matches)
      .set({ status: 'active', startedAt: new Date() })
      .where(eq(matches.id, matchId));

    console.log(`[room] match ${matchId} started`);
  }

  private async handleAction(
    client: Client,
    _type: string,
    raw: unknown,
  ): Promise<void> {
    // 1. Derive player identity from session — never trust the message payload
    const userId = this.sessionToUser.get(client.sessionId);
    if (!userId) {
      client.error(403, 'Unknown session');
      return;
    }

    // 2. Validate the action shape with the shared Zod schema
    const result = ClientActionSchema.safeParse(raw);
    if (!result.success) {
      client.error(422, 'Invalid action: ' + result.error.message);
      return;
    }
    const action = result.data;

    // 3. Guard: only allow actions when the match is active
    if (this.state.phase !== 'active') {
      client.error(400, 'Match is not active');
      return;
    }

    // 4. Guard: only the current player may act
    if (this.state.currentPlayerId !== userId) {
      client.error(400, 'It is not your turn');
      return;
    }

    // 5. Dispatch to the correct handler
    if (action.type === 'place') {
      await this.handlePlace(client, userId, action.position);
    } else if (action.type === 'surrender') {
      await this.handleSurrender(userId);
    }
    // 'end_turn' is implicit after 'place' in tic-tac-toe — no separate handler needed
  }

  private async handlePlace(
    client: Client,
    userId: string,
    position: number,
  ): Promise<void> {
    const board = decodeBoard(this.state.board);

    // Guard: cell must be empty
    if (board[position] !== null) {
      client.error(400, 'Cell is already occupied');
      return;
    }

    const player = this.state.players.get(userId);
    if (!player) return;

    // Apply the move
    board[position] = player.mark as Mark;
    this.state.board = encodeBoard(board);
    this.state.turnNumber += 1;

    await this.logEvent(userId, 'place', { position });

    // Check for a winner or draw
    const outcome = checkWinner(board);

    if (outcome !== null) {
      await this.finishMatch(outcome);
      return;
    }

    // Advance to the next player
    this.state.players.forEach((p) => {
      if (p.userId !== userId) {
        this.state.currentPlayerId = p.userId;
      }
    });
  }

  private async handleSurrender(userId: string): Promise<void> {
    await this.logEvent(userId, 'surrender', {});

    // The other player wins
    let winnerId = '';
    this.state.players.forEach((p) => {
      if (p.userId !== userId) winnerId = p.userId;
    });

    await this.finishMatch('surrender', winnerId);
  }

  private async finishMatch(
    outcome: Mark | 'draw' | 'surrender',
    explicitWinnerId?: string,
  ): Promise<void> {
    this.state.phase = 'finished';

    let winnerId: string | null = null;

    if (outcome === 'draw') {
      // No winner
    } else if (outcome === 'surrender' && explicitWinnerId) {
      winnerId = explicitWinnerId;
      this.state.winnerId = winnerId;
    } else {
      // outcome is 'X' or 'O' — find the player with that mark
      this.state.players.forEach((p) => {
        if (p.mark === outcome) winnerId = p.userId;
      });
      if (winnerId) this.state.winnerId = winnerId;
    }

    // Persist result
    const matchId = this.roomId;
    await db
      .update(matches)
      .set({
        status:     'finished',
        winnerId:   winnerId ?? undefined,
        finishedAt: new Date(),
      })
      .where(eq(matches.id, matchId));

    // Update each player's result in match_players
    this.state.players.forEach(async (p) => {
      let result: string;
      if (!winnerId)           result = 'draw';
      else if (p.userId === winnerId) result = 'win';
      else                     result = 'loss';

      await db
        .update(matchPlayers)
        .set({ result })
        .where(eq(matchPlayers.userId, p.userId));
    });

    console.log(`[room] match finished. winner: ${winnerId ?? 'draw'}`);

    // Allow room auto-disposal now that the match is over
    this.autoDispose = true;
  }

  private async logEvent(
    userId: string,
    actionType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const matchId = this.roomId;
    await db.insert(turnEvents).values({
      matchId,
      turnNumber: this.state.turnNumber,
      playerId:   userId,
      actionType,
      payload,
    });
  }
}
