/**
 * Shared message types for the WebSocket protocol.
 * Server → Client messages and Client → Server messages.
 */

import type { Board, MatchPhase, Player } from '@repo/shared';

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export interface StateMsg {
  type: 'state';
  payload: {
    roomId:        string;
    sessionId:     string;   // only sent to the recipient
    board:         Board;
    phase:         MatchPhase;
    currentPlayer: Player;
    winner:        Player | 'draw' | null;
    playerX:       string | null;
    playerO:       string | null;
  };
}

export interface ErrorMsg {
  type: 'error';
  payload: { message: string };
}

export type ServerMsg = StateMsg | ErrorMsg;

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export interface JoinMsg {
  type: 'join';
  payload: { roomId?: string };   // omit to create / join any open room
}

export interface ActionMsg {
  type: 'action';
  payload: { type: 'place_mark'; cell: number } | { type: 'resign' };
}

export type ClientMsg = JoinMsg | ActionMsg;
