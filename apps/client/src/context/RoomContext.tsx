/**
 * RoomContext — holds the active Colyseus Room across page navigations.
 * LobbyPage stores the room here; MatchPage reads it.
 */
import { createContext, useContext, useRef, type ReactNode } from 'react';
import type { Room } from 'colyseus.js';
import type { TicTacToeState } from '@repo/shared';

interface RoomContextValue {
  getRoom: () => Room<TicTacToeState> | null;
  setRoom: (room: Room<TicTacToeState> | null) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  // useRef so updates don't trigger re-renders
  const roomRef = useRef<Room<TicTacToeState> | null>(null);

  return (
    <RoomContext.Provider value={{
      getRoom: () => roomRef.current,
      setRoom: (r) => { roomRef.current = r; },
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside <RoomProvider>');
  return ctx;
}
