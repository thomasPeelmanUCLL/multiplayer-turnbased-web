/**
 * Client → Server WebSocket actions.
 *
 * Each action is a plain discriminated union. The server validates the
 * incoming message against the matching Zod schema before processing it.
 */
export type PlaceAction = {
  type: 'place';
  /** Board position 0-8 for tic-tac-toe */
  position: number;
};

export type EndTurnAction = {
  type: 'end_turn';
};

export type SurrenderAction = {
  type: 'surrender';
};

/** Union of every action a client may send. */
export type ClientAction = PlaceAction | EndTurnAction | SurrenderAction;

export type ActionType = ClientAction['type'];
