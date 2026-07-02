/**
 * TicTacToeSchema is intentionally empty.
 *
 * We do NOT use @colyseus/schema's binary state sync — it caused ArraySchema
 * mutation bugs and adds complexity with zero benefit for a turn-based game.
 *
 * Instead, BaseRoom.broadcastState() sends plain JSON via this.broadcast('state', ...).
 * This file exists only to satisfy the colyseus.Room<T> generic; it is never
 * serialized or sent to clients.
 */
import { Schema } from '@colyseus/schema';
export class TicTacToeSchema extends Schema {}
