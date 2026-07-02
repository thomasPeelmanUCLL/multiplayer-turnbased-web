/**
 * useMatch — connects to a Colyseus room and returns typed game state.
 *
 * Usage:
 *   const { room, state, status } = useMatch('tictactoe', matchId);
 *   room?.send('action', { type: 'place_mark', cell: 4 });
 *
 * Adding a new game:
 *   Just call useMatch('poker', matchId) — the hook is game-agnostic.
 *   Define your state shape as TState and pass it as the generic.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Colyseus from 'colyseus.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

export type ConnectionStatus = 'connecting' | 'joined' | 'error' | 'left';

export interface UseMatchReturn<TState> {
  room:   Colyseus.Room | null;
  state:  TState | null;
  status: ConnectionStatus;
  send:   (action: object) => void;
}

export function useMatch<TState = Record<string, unknown>>(
  gameType: string,
  roomId?: string,
): UseMatchReturn<TState> {
  const clientRef = useRef<Colyseus.Client | null>(null);
  const roomRef   = useRef<Colyseus.Room | null>(null);

  const [room,   setRoom]   = useState<Colyseus.Room | null>(null);
  const [state,  setState]  = useState<TState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const client = new Colyseus.Client(WS_URL);
    clientRef.current = client;

    async function connect() {
      try {
        const r = roomId && roomId !== 'new'
          ? await client.joinById(roomId)
          : await client.joinOrCreate(gameType);

        roomRef.current = r;
        setRoom(r);
        setStatus('joined');

        r.onMessage('state', (payload: TState) => {
          setState(payload);
        });

        r.onMessage('error', (payload: { message: string }) => {
          console.error('[useMatch] server error:', payload.message);
        });

        r.onLeave(() => {
          setStatus('left');
          setRoom(null);
        });
      } catch (err) {
        console.error('[useMatch] connection failed:', err);
        setStatus('error');
      }
    }

    void connect();

    return () => {
      roomRef.current?.leave();
      roomRef.current = null;
      clientRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((action: object) => {
    roomRef.current?.send('action', action);
  }, []);

  return { room, state, status, send };
}
