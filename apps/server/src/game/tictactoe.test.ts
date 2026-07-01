// Unit tests for the tic-tac-toe game logic.
// Run with: pnpm test (vitest)

import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "./tictactoe";
import type { TicTacToeState } from "@repo/shared";

// Helper: fast-forward a state into "active" with both players seated
function activeState(overrides?: Partial<TicTacToeState>): TicTacToeState {
  return {
    ...createInitialState(),
    phase: "active",
    players: { X: "user-1", O: "user-2" },
    ...overrides,
  };
}

describe("applyAction — place_mark", () => {
  it("rejects a move when the match is not active", () => {
    const state = createInitialState(); // phase = "waiting"
    const result = applyAction(state, "X", { type: "place_mark", cell: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects a move when it is not the player's turn", () => {
    const state = activeState(); // currentPlayer = "X"
    const result = applyAction(state, "O", { type: "place_mark", cell: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects a move on an out-of-range cell", () => {
    const state = activeState();
    const result = applyAction(state, "X", { type: "place_mark", cell: 9 });
    expect(result.ok).toBe(false);
  });

  it("rejects a move on an already occupied cell", () => {
    const board = ["X", null, null, null, null, null, null, null, null] as TicTacToeState["board"];
    const state = activeState({ board, currentPlayer: "O" });
    const result = applyAction(state, "O", { type: "place_mark", cell: 0 });
    expect(result.ok).toBe(false);
  });

  it("places a mark and advances the turn", () => {
    const state = activeState();
    const result = applyAction(state, "X", { type: "place_mark", cell: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.board[4]).toBe("X");
    expect(result.newState.currentPlayer).toBe("O");
    expect(result.newState.phase).toBe("active");
  });

  it("detects a win", () => {
    // X owns 0,1 — placing on 2 completes the top row
    const board = ["X", "X", null, "O", "O", null, null, null, null] as TicTacToeState["board"];
    const state = activeState({ board });
    const result = applyAction(state, "X", { type: "place_mark", cell: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.phase).toBe("finished");
    expect(result.newState.winner).toBe("X");
  });

  it("detects a draw", () => {
    // Board one move from a full draw: X to play at cell 8
    //  X | O | X
    //  O | X | O
    //  O | X | _
    const board = ["X", "O", "X", "O", "X", "O", "O", "X", null] as TicTacToeState["board"];
    const state = activeState({ board });
    const result = applyAction(state, "X", { type: "place_mark", cell: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.phase).toBe("finished");
    expect(result.newState.winner).toBe("draw");
  });
});

describe("applyAction — resign", () => {
  it("ends the match and gives the win to the opponent", () => {
    const state = activeState();
    const result = applyAction(state, "X", { type: "resign" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.phase).toBe("finished");
    expect(result.newState.winner).toBe("O");
  });
});
