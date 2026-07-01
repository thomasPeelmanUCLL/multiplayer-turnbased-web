// React hook — manages the WebSocket connection to a Colyseus match room.
// Components call this and get back live state + a sendAction function.

import { useEffect, useRef, useState } from "react";
import { Client, type Room } from "colyseus.js";
import type { ClientAction, TicTacToeState } from "@repo/shared";

const colyseusClient = new Client(import.meta.env.VITE_SERVER_WS_URL);

interface UseMatchReturn {
  matchState: TicTacToeState | null;
  /** Non-null when the connection failed or the server sent an error */
  error: string | null;
  sendAction: (action: ClientAction) => void;
}

export function useMatch(roomId: string): UseMatchReturn {
  const roomRef = useRef<Room<TicTacToeState> | null>(null);
  const [matchState, setMatchState] = useState<TicTacToeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    colyseusClient
      .joinById<TicTacToeState>(roomId)
      .then((room) => {
        if (cancelled) {
          room.leave();
          return;
        }
        roomRef.current = room;
        room.onStateChange((state) => setMatchState({ ...state }));
        room.onError((_code, message) =>
          setError(message ?? "Unknown connection error"),
        );
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [roomId]);

  function sendAction(action: ClientAction) {
    if (!roomRef.current) {
      console.warn("sendAction called before room was ready");
      return;
    }
    roomRef.current.send("action", action);
  }

  return { matchState, error, sendAction };
}
