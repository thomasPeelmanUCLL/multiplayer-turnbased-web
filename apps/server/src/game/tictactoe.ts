// Pure game logic — no Colyseus or Express imports.
// Every function is a pure transformation: state in → result out.
// This makes the rules trivially unit-testable.

import type { Board, ClientAction, Player, TicTacToeState } from "@repo/shared";

// ---------------------------------------------------------------------------
// Result type
// Using { ok } instead of throwing keeps error handling explicit at call sites.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true; newState: TicTacToeState }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialState(): TicTacToeState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    phase: "waiting",
    currentPlayer: "X",
    winner: null,
    players: { X: null, O: null },
  };
}

// ---------------------------------------------------------------------------
// Apply an action from a player
// ---------------------------------------------------------------------------

export function applyAction(
  state: TicTacToeState,
  player: Player,
  action: ClientAction,
): ActionResult {
  if (state.phase !== "active") {
    return { ok: false, error: "Match is not active" };
  }
  if (state.currentPlayer !== player) {
    return { ok: false, error: "Not your turn" };
  }

  switch (action.type) {
    case "place_mark":
      return placeMark(state, player, action.cell);
    case "resign":
      return resign(state, player);
  }
}

// ---------------------------------------------------------------------------
// Individual action handlers (private to this module)
// ---------------------------------------------------------------------------

function placeMark(
  state: TicTacToeState,
  player: Player,
  cell: number,
): ActionResult {
  if (!isCellInRange(cell)) {
    return { ok: false, error: `Cell ${cell} is out of range (0–8)` };
  }
  if (state.board[cell] !== null) {
    return { ok: false, error: `Cell ${cell} is already taken` };
  }

  const newBoard = [...state.board] as Board;
  newBoard[cell] = player;

  const winner = findWinner(newBoard);
  const isDraw = !winner && newBoard.every((c) => c !== null);

  return {
    ok: true,
    newState: {
      ...state,
      board: newBoard,
      currentPlayer: opponent(player),
      phase: winner || isDraw ? "finished" : "active",
      winner: winner ?? (isDraw ? "draw" : null),
    },
  };
}

function resign(state: TicTacToeState, player: Player): ActionResult {
  return {
    ok: true,
    newState: {
      ...state,
      phase: "finished",
      winner: opponent(player),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIN_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function findWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player;
    }
  }
  return null;
}

function isCellInRange(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell <= 8;
}

function opponent(player: Player): Player {
  return player === "X" ? "O" : "X";
}
