// actions.ts defines a legacy ClientAction union with different action names
// than tictactoe.ts. Export them under namespaced names to avoid TS2308.
export type {
  PlaceAction,
  EndTurnAction,
  SurrenderAction,
  ActionType,
} from './actions.js';

export * from './schemas.js';
export * from './state.js';
export * from './tictactoe.js';
export * from './validation.js';
