/**
 * BaseRoom — abstract Colyseus room every game extends.
 *
 * Responsibilities:
 *  - Uniform error sending
 *  - broadcastState() helper (plain JSON, no ArraySchema)
 *  - onMessage routing to handleAction()
 *  - Lifecycle logging
 *
 * Each subclass only needs to implement:
 *  - maxClients
 *  - getStatePlain()  → the plain object sent to clients
 *  - handleAction()   → process one validated action
 */
import * as colyseus from 'colyseus';
import type { Client } from 'colyseus';
import { logger } from '../lib/logger.js';

export type ActionMessage = { type: string; [key: string]: unknown };

export abstract class BaseRoom<TState = unknown> extends colyseus.Room {
  // -------------------------------------------------------------------------
  // Abstract contract every game must fulfill
  // -------------------------------------------------------------------------

  /** Return the plain JS object that should be sent to every client. */
  protected abstract getStatePlain(): TState;

  /**
   * Apply a validated action from a connected client.
   * Send errors via this.sendError(client, msg).
   */
  protected abstract handleAction(client: Client, action: ActionMessage): void;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  onCreate() {
    this.autoDispose = true;

    this.onMessage<ActionMessage>('action', (client, action) => {
      this.handleAction(client, action);
    });

    logger.info({ roomId: this.roomId, game: this.constructor.name }, 'Room created');
  }

  onJoin(client: Client) {
    logger.info({ roomId: this.roomId, sessionId: client.sessionId }, 'Client joined');
    this.broadcastState();
  }

  onLeave(client: Client) {
    logger.info({ roomId: this.roomId, sessionId: client.sessionId }, 'Client left');
  }

  onDispose() {
    logger.info({ roomId: this.roomId }, 'Room disposed');
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Broadcast the current game state to every connected client. */
  protected broadcastState() {
    this.broadcast('state', this.getStatePlain());
  }

  /** Send an error message to a single client. */
  protected sendError(client: Client, message: string) {
    client.send('error', { message });
    logger.warn({ roomId: this.roomId, sessionId: client.sessionId, message }, 'Sent error to client');
  }
}
