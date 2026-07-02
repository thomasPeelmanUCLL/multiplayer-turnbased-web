/**
 * Match page — tic-tac-toe board.
 *
 * If navigated from LobbyPage the live Room object arrives via router state.
 * If the page is loaded directly (refresh / deep link) it joins by ID instead.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';
import type { TicTacToeState, Player } from '@repo/shared';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();

  const roomRef = useRef<Room<TicTacToeState> | null>(
    // Reuse the room passed from LobbyPage if available
    (location.state as { room?: Room<TicTacToeState> } | null)?.room ?? null,
  );

  const [state,     setState]     = useState<TicTacToeState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    roomRef.current?.sessionId ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;

    function attachHandlers(room: Room<TicTacToeState>) {
      roomRef.current = room;
      setSessionId(room.sessionId);
      room.onStateChange((snapshot) =>
        setState({ ...snapshot } as unknown as TicTacToeState),
      );
      room.onError((code, msg) => setError(`Room error ${code}: ${msg}`));
      room.onLeave(() => { roomRef.current = null; });
    }

    if (roomRef.current) {
      // Already have a live room from LobbyPage
      attachHandlers(roomRef.current);
    } else {
      // Deep-link / refresh — join by ID
      new ColyseusClient(WS_URL)
        .joinById<TicTacToeState>(matchId)
        .then(attachHandlers)
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to connect'),
        );
    }

    return () => { roomRef.current?.leave(); };
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
