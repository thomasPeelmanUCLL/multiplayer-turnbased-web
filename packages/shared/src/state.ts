/**
 * Shared match state types.
 *
 * These types mirror the Colyseus room state on the server and the
 * state the client receives via state-sync patches.
 */

/** 'X' | 'O' — the two tic-tac-toe marks */
export type Mark = 'X' | 'O';

/** Serialisable representation of one player inside a match */
export type PlayerSnapshot = {
  userId: string;
  username: string;
  mark: Mark;
  connected: boolean;
};

/**
 * The full match state broadcast to every client in the room.
 *
 * `board` is a 9-element array for tic-tac-toe.
 * Index 0 = top-left, 8 = bottom-right.
 */
export type MatchSnapshot = {
  matchId: string;
  phase: 'waiting' | 'active' | 'finished';
  currentPlayerId: string;
  turnNumber: number;
  /** null = empty cell */
  board: (Mark | null)[];
  players: Record<string, PlayerSnapshot>;
  /** Set when phase = 'finished'. null means draw. */
  winnerId: string | null;
};
