/**
 * Match page — tic-tac-toe board.
 *
 * Reads the live Room from RoomContext (set by LobbyPage).
 * Falls back to joinById for direct URL access / page refresh.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';
import type { TicTacToeState, Player } from '@repo/shared';
import { useRoomContext } from '../context/RoomContext.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const { getRoom, setRoom } = useRoomContext();

  const roomRef = useRef<Room<TicTacToeState> | null>(null);

  const [state,     setState]     = useState<TicTacToeState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;

    function attachHandlers(room: Room<TicTacToeState>) {
      roomRef.current = room;
      setSessionId(room.sessionId);
      room.onStateChange((snapshot) =>
        setState({ ...snapshot } as unknown as TicTacToeState),
      );
      room.onError((code, msg) => setError(`Room error ${code}: ${msg}`));
      room.onLeave(() => {
        roomRef.current = null;
        setRoom(null);
      });
    }

    const existing = getRoom();
    if (existing) {
      attachHandlers(existing);
    } else {
      // Deep-link or refresh — rejoin by ID
      new ColyseusClient(WS_URL)
        .joinById<TicTacToeState>(matchId)
        .then((room) => {
          setRoom(room);
          attachHandlers(room);
        })
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to connect'),
        );
    }

    return () => {
      // Only leave if we're truly unmounting (navigating away from match)
      roomRef.current?.leave();
      setRoom(null);
    };
  }, [matchId]);

  function place(position: number) {
    roomRef.current?.send('action', { type: 'place_mark', cell: position });
  }

  if (error) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => navigate('/lobby')}>Back to lobby</button>
      </main>
    );
  }

  if (!state || !sessionId) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <p>Connecting…</p>
      </main>
    );
  }

  const myMark: Player | undefined =
    sessionId === state.players.X ? 'X' :
    sessionId === state.players.O ? 'O' : undefined;

  const isMyTurn =
    state.phase === 'active' && myMark !== undefined &&
    state.currentPlayer === myMark;

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h1 style={{ margin: 0 }}>Tic-Tac-Toe</h1>
        <button onClick={() => navigate('/lobby')}>← Lobby</button>
      </header>

      <p style={{ marginTop: 16, fontSize: 18 }}>
        {state.phase === 'waiting'  && '⏳ Waiting for opponent…'}
        {state.phase === 'active'   && (isMyTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn')}
        {state.phase === 'finished' && (
          state.winner === 'draw' ? '🤝 Draw!'
            : state.winner === myMark ? '🎉 You won!' : '😔 You lost'
        )}
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, marginTop: 24, maxWidth: 300,
      }}>
        {state.board.map((cell, i) => (
          <button
            key={i}
            disabled={!isMyTurn || cell !== null}
            onClick={() => place(i)}
            style={{
              height: 90, fontSize: 40, fontWeight: 'bold',
              background: '#fff', border: '2px solid #ccc', borderRadius: 8,
              cursor: isMyTurn && cell === null ? 'pointer' : 'default',
            }}
          >
            {cell ?? ''}
          </button>
        ))}
      </div>

      <p style={{ color: '#666', fontSize: 14, marginTop: 20 }}>
        You are playing as <strong>{myMark ?? '…'}</strong>
      </p>
    </main>
  );
}
