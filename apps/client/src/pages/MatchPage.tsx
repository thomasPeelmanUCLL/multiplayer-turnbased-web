/**
 * Match page — tic-tac-toe board.
 *
 * Connects to the Colyseus room for this match and renders the board.
 * Player identity is sent from the verified in-memory auth state.
 * The board is read-only when it is not this player's turn.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient } from 'colyseus.js';
import { useAuth } from '../hooks/useAuth.js';
import type { MatchSnapshot, Mark } from '@repo/shared';

const WS_URL = 'ws://localhost:2567';

export function MatchPage() {
  const { matchId }               = useParams<{ matchId: string }>();
  const navigate                  = useNavigate();
  const { userId, username, accessToken } = useAuth();

  const roomRef = useRef<Awaited<ReturnType<ColyseusClient['joinById']>> | null>(null);
  const [state,   setState]   = useState<MatchSnapshot | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // ── Connect to the Colyseus room ────────────────────────────────────────────
  useEffect(() => {
    if (!matchId || !userId || !username || !accessToken) return;

    const client = new ColyseusClient(WS_URL);

    client
      .joinById<MatchSnapshot>(matchId, { matchId, userId, username })
      .then((room) => {
        roomRef.current = room;

        room.onStateChange((snapshot) => {
          setState({ ...snapshot } as unknown as MatchSnapshot);
        });

        room.onError((code, message) => {
          setError(`Room error ${code}: ${message}`);
        });

        room.onLeave(() => {
          roomRef.current = null;
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to connect to match');
      });

    return () => {
      roomRef.current?.leave();
    };
  }, [matchId, userId, username, accessToken]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  function place(position: number) {
    roomRef.current?.send('place', { type: 'place', position });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => navigate('/lobby')}>Back to lobby</button>
      </main>
    );
  }

  if (!state) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
        <p>Connecting…</p>
      </main>
    );
  }

  const board   = state.board as unknown as string;
  const cells   = typeof board === 'string' ? board.split(',') : Array(9).fill('');
  const isMyTurn = state.currentPlayerId === userId && state.phase === 'active';
  const myMark  = userId && state.players[userId]?.mark;

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Tic-Tac-Toe</h1>
        <button onClick={() => navigate('/lobby')}>← Lobby</button>
      </header>

      {/* Status line */}
      <p style={{ marginTop: 16 }}>
        {state.phase === 'waiting' && 'Waiting for opponent…'}
        {state.phase === 'active'  && (isMyTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn')}
        {state.phase === 'finished' && (
          state.winnerId
            ? state.winnerId === userId ? '🎉 You won!' : '😔 You lost'
            : '🤝 Draw!'
        )}
      </p>

      {/* Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 24,
          maxWidth: 300,
        }}
      >
        {cells.map((cell, i) => (
          <button
            key={i}
            disabled={!isMyTurn || cell !== ''}
            onClick={() => place(i)}
            style={{
              height: 90,
              fontSize: 36,
              fontWeight: 'bold',
              background: '#fff',
              border: '2px solid #ccc',
              borderRadius: 8,
              cursor: isMyTurn && cell === '' ? 'pointer' : 'default',
            }}
          >
            {cell as Mark | ''}
          </button>
        ))}
      </div>

      {/* Player info */}
      <section style={{ marginTop: 24 }}>
        <p style={{ color: '#666', fontSize: 14 }}>
          You are playing as <strong>{myMark ?? '…'}</strong>
        </p>
      </section>
    </main>
  );
}
