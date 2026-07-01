// Shared types for tic-tac-toe — imported by both client and server.
// Keep this file free of framework imports so it stays portable.

export type Player = "X" | "O";
export type Cell = Player | null;

/**
 * The board is a flat 9-element array representing a 3×3 grid.
 *
 *  0 | 1 | 2
 * ---+---+---
 *  3 | 4 | 5
 * ---+---+---
 *  6 | 7 | 8
 */
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

export type MatchPhase = "waiting" | "active" | "finished";

export interface TicTacToeState {
  board: Board;
  phase: MatchPhase;
  currentPlayer: Player;
  /** null while the match is ongoing */
  winner: Player | "draw" | null;
  players: {
    X: string | null; // userId
    O: string | null;
  };
}

// ---------------------------------------------------------------------------
// Actions the client can send to the server.
// Using a discriminated union means exhaustive checks work in switch/if-else.
// ---------------------------------------------------------------------------

export type ClientAction =
  | { type: "place_mark"; cell: number } // cell index 0–8
  | { type: "resign" };
