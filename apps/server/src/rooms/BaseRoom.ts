import { Room } from 'colyseus';
import type { Client } from 'colyseus';
import { logger } from '../lib/logger.js';

export type ActionMessage = { type: string; [key: string]: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseRoom extends Room<any> {
  protected abstract getStatePlain(): unknown;
  protected abstract handleAction(client: Client, action: ActionMessage): void;

  onCreate() {
    this.autoDispose = true;
    this.onMessage<ActionMessage>('action', (client, action) => {
      try {
        this.handleAction(client, action);
      } catch (err) {
        logger.error(
          { roomId: this.roomId, sessionId: client.sessionId, action, err },
          'Unhandled error in handleAction',
        );
        this.sendError(client, 'Internal server error');
      }
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

  protected broadcastState() {
    this.broadcast('state', this.getStatePlain());
  }

  protected sendError(client: Client, message: string) {
    client.send('error', { message });
    logger.warn({ roomId: this.roomId, sessionId: client.sessionId, message }, 'Sent error to client');
  }
}
