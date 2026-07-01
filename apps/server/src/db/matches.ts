// Database writes for match results.
// Thin layer: translate domain types to SQL — no game logic here.

import type { TicTacToeState } from "@repo/shared";
import { db } from "./client";
import { matches } from "./schema";

/**
 * Persist the final state of a finished match.
 * Called once when phase transitions to "finished".
 */
export async function saveMatchResult(
  roomId: string,
  state: TicTacToeState,
): Promise<void> {
  await db
    .insert(matches)
    .values({
      id: roomId,
      playerX: state.players.X!,
      playerO: state.players.O!,
      winner: state.winner,
      finishedAt: new Date(),
    })
    .onConflictDoNothing(); // idempotent — safe to retry
}
