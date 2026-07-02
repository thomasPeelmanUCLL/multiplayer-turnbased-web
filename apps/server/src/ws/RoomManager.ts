import type { WebSocket } from 'ws';
import { GameRoom } from './GameRoom.js';
import { logger } from '../lib/logger.js';
import type { ClientMsg } from './protocol.js';

/**
 * RoomManager:
 * - keeps a map of roomId → GameRoom
 * - keeps a map of sessionId → GameRoom so we can route messages
 * - handles join, action, and disconnect
 */
export class RoomManager {
  private rooms    = new Map<string, GameRoom>();
  private sessions = new Map<string, { room: GameRoom; sessionId: string }>();

  handleConnection(socket: WebSocket) {
    logger.info('WS connection opened');

    socket.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString()) as ClientMsg;
      } catch {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON' } }));
        return;
      }

      this.route(socket, msg);
    });

    socket.on('close', () => {
      const entry = [...this.sessions.entries()].find(([, v]) => v.room.removePlayer !== undefined && this.socketForSession(v.sessionId) === socket);
      if (!entry) return;
      const [, { room, sessionId }] = entry;
      room.removePlayer(sessionId);
      this.sessions.delete(sessionId);
      if (room.isEmpty) {
        this.rooms.delete(room.roomId);
        logger.info({ roomId: room.roomId }, 'Room disposed');
      }
    });
  }

  private route(socket: WebSocket, msg: ClientMsg) {
    switch (msg.type) {
      case 'join':   this.handleJoin(socket, msg.payload?.roomId); break;
      case 'action': this.handleAction(socket, msg.payload);       break;
    }
  }

  private handleJoin(socket: WebSocket, roomId?: string) {
    // Find an existing open room or create a new one
    let room: GameRoom | undefined;

    if (roomId) {
      room = this.rooms.get(roomId);
      if (!room) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: `Room ${roomId} not found` } }));
        return;
      }
    } else {
      // Find any room with 1 player waiting
      room = [...this.rooms.values()].find(r => !r.isFull);
      if (!room) {
        room = new GameRoom();
        this.rooms.set(room.roomId, room);
        logger.info({ roomId: room.roomId }, 'New room created');
      }
    }

    if (room.isFull) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Room is full' } }));
      return;
    }

    const player = room.addPlayer(socket);
    this.sessions.set(player.sessionId, { room, sessionId: player.sessionId });
  }

  private handleAction(socket: WebSocket, payload: ClientMsg['payload']) {
    // Find which session this socket belongs to
    const entry = [...this.sessions.entries()].find(
      ([, v]) => this.socketForSession(v.sessionId) === socket
    );
    if (!entry) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Join a room first' } }));
      return;
    }
    const [, { room, sessionId }] = entry;
    room.handleAction(sessionId, payload as Parameters<GameRoom['handleAction']>[1]);
  }

  // Helper: look up the socket for a given sessionId
  private socketForSession(sessionId: string): WebSocket | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;
    // walk the room's internal players — we expose this via a getter
    return (entry.room as unknown as { players: Array<{ sessionId: string; socket: WebSocket }> })
      .players.find(p => p.sessionId === sessionId)?.socket;
  }
}
