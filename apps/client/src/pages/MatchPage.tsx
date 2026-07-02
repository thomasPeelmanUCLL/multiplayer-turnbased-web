/**
 * Match page — tic-tac-toe board.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

interface Players { X: string; O: string; }
interface MatchState {
  board: string[];
  phase: string;
  currentPlayer: string;
  winner: string;
  players: Players;
}

function snapshot(room: Room<MatchState>): MatchState {
  // Deep-copy the live Schema so React sees a new reference
  const s = room.state;
  return {
    board: Array.from(s.board as unknown as Iterable<string>),
    phase: s.phase,
    currentPlayer: s.currentPlayer,
    winner: s.winner,
    players: { X: s.players.X, O: s.players.O },
  };
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const roomRef = useRef<Room<MatchState> | null>(null);

  const [state,     setState]     = useState<MatchState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const client = new ColyseusClient(WS_URL);
    let cancelled = false;

    function attachHandlers(room: Room<MatchState>) {
      if (cancelled) { room.leave(); return; }
      roomRef.current = room;
      setSessionId(room.sessionId);

      if (matchId === 'new') {
        navigate(`/match/${room.roomId}`, { replace: true });
      }

      // Seed immediately with whatever state the server sent on join
      setState(snapshot(room));

      // Then keep in sync with every subsequent patch
      room.onStateChange(() => setState(snapshot(room)));
      room.onError((code, msg) => setError(`Room error ${code}: ${msg}`));
      room.onLeave(() => { roomRef.current = null; });
    }

    const promise = matchId === 'new'
      ? client.joinOrCreate<MatchState>('tictactoe')
      : client.joinById<MatchState>(matchId!);

    promise
      .then(attachHandlers)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to connect'),
      );

    return () => { cancelled = true; roomRef.current?.leave(); roomRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function place(i: number) {
    roomRef.current?.send('action', { type: 'place_mark', cell: i });
  }

  if (error) return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
      <p style={{ color: 'red' }}>{error}</p>
      <button onClick={() => navigate('/lobby')}>Back to lobby</button>
    </main>
  );

  if (!state || !sessionId) return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
      <p>Connecting…</p>
    </main>
  );

  const myMark = sessionId === state.players.X ? 'X'
               : sessionId === state.players.O ? 'O'
               : null;

  const isMyTurn =
    state.phase === 'active' && myMark !== null && state.currentPlayer === myMark;

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Tic-Tac-Toe</h1>
        <button onClick={() => navigate('/lobby')}>← Lobby</button>
      </header>

      <p style={{ marginTop: 16, fontSize: 18 }}>
        {state.phase === 'waiting'  && '⏳ Waiting for opponent…'}
        {state.phase === 'active'   && (isMyTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn')}
        {state.phase === 'finished' && (
          state.winner === 'draw'   ? '🤝 Draw!'
          : state.winner === myMark ? '🎉 You won!'
          : '😔 You lost'
        )}
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, marginTop: 24, maxWidth: 300,
      }}>
        {state.board.map((cell, i) => (
          <button
            key={i}
            disabled={!isMyTurn || cell !== ''}
            onClick={() => place(i)}
            style={{
              height: 90, fontSize: 40, fontWeight: 'bold',
              background: '#fff', border: '2px solid #ccc', borderRadius: 8,
              cursor: isMyTurn && cell === '' ? 'pointer' : 'default',
            }}
          >
            {cell}
          </button>
        ))}
      </div>

      <p style={{ color: '#666', fontSize: 14, marginTop: 20 }}>
        You are playing as <strong>{myMark ?? '…'}</strong>
      </p>
    </main>
  );
}
