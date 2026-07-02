import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../hooks/useMatch.js';

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const { state, status, logs, placeMark, resign } = useMatch(matchId);

  // Redirect once we know our roomId (when joining 'new')
  if (state && matchId === 'new') {
    navigate(`/match/${state.roomId}`, { replace: true });
  }

  const sessionId = state?.sessionId ?? null;
  const myMark =
    sessionId && state
      ? sessionId === state.playerX ? 'X'
      : sessionId === state.playerO ? 'O'
      : null
    : null;

  const isMyTurn =
    state?.phase === 'active' &&
    myMark !== null &&
    state.currentPlayer === myMark;

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Tic-Tac-Toe</h1>
        <button onClick={() => navigate('/lobby')}>← Lobby</button>
      </header>

      {/* Status line */}
      <p style={{ marginTop: 16, fontSize: 18 }}>
        {status === 'connecting' && '⏳ Connecting…'}
        {status === 'error'      && '❌ Connection error'}
        {status === 'closed'     && '🔒 Disconnected'}
        {status === 'open' && !state && '⏳ Joining room…'}
        {state?.phase === 'waiting'  && '⏳ Waiting for opponent…'}
        {state?.phase === 'active'   && (isMyTurn ? '🟢 Your turn' : "⏳ Opponent's turn")}
        {state?.phase === 'finished' && (
          state.winner === 'draw'   ? '🤝 Draw!'
          : state.winner === myMark ? '🎉 You won!'
          : '😔 You lost'
        )}
      </p>

      {/* Board */}
      {state && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginTop: 24, maxWidth: 300,
        }}>
          {state.board.map((cell, i) => (
            <button
              key={i}
              disabled={!isMyTurn || cell !== null}
              onClick={() => placeMark(i)}
              style={{
                height: 90, fontSize: 40, fontWeight: 'bold',
                background: '#fff', border: '2px solid #ccc', borderRadius: 8,
                cursor: isMyTurn && cell === null ? 'pointer' : 'default',
                color: cell === 'X' ? '#e74c3c' : '#3498db',
              }}
            >
              {cell ?? ''}
            </button>
          ))}
        </div>
      )}

      {/* Info row */}
      {state && (
        <p style={{ color: '#666', fontSize: 14, marginTop: 20 }}>
          You: <strong>{myMark ?? '…'}</strong>
          {' | '}room: {state.roomId}
          {' | '}phase: {state.phase}
          {state.phase === 'active' && ` | turn: ${state.currentPlayer}`}
        </p>
      )}

      {/* Resign button */}
      {state?.phase === 'active' && (
        <button
          onClick={resign}
          style={{ marginTop: 16, color: '#c0392b', background: 'none', border: '1px solid #c0392b', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
        >
          Resign
        </button>
      )}

      {/* Debug log */}
      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#999' }}>Debug log</summary>
        <div style={{
          marginTop: 8, padding: 12, background: '#1a1a1a', color: '#0f0',
          fontFamily: 'monospace', fontSize: 11, borderRadius: 6,
          maxHeight: 260, overflowY: 'auto',
        }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </details>
    </main>
  );
}
