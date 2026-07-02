import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMatch } from '../hooks/useMatch.js';

// Shape of the state payload broadcast by TicTacToeRoom.getStatePlain()
interface TicTacToeState {
  board:         (string | null)[];
  phase:         'waiting' | 'active' | 'finished';
  currentPlayer: 'X' | 'O';
  winner:        'X' | 'O' | 'draw' | null;
  playerX:       string | null;
  playerO:       string | null;
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const { room, state, status, send } = useMatch<TicTacToeState>('tictactoe', matchId);

  // Once joined, reflect the real roomId in the URL
  useEffect(() => {
    if (room && matchId === 'new') {
      navigate(`/match/${room.id}`, { replace: true });
    }
  }, [room, matchId, navigate]);

  const sessionId = room?.sessionId ?? null;
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

      <p style={{ marginTop: 16, fontSize: 18 }}>
        {status === 'connecting'                 && '⏳ Connecting…'}
        {status === 'error'                      && '❌ Connection error'}
        {status === 'left'                       && '🔒 Disconnected'}
        {status === 'joined' && !state           && '⏳ Waiting for state…'}
        {state?.phase === 'waiting'              && '⏳ Waiting for opponent…'}
        {state?.phase === 'active' && isMyTurn   && '🟢 Your turn'}
        {state?.phase === 'active' && !isMyTurn  && "⏳ Opponent's turn"}
        {state?.phase === 'finished' && (
          state.winner === 'draw'   ? '🤝 Draw!'
          : state.winner === myMark ? '🎉 You won!'
          :                          '😔 You lost'
        )}
      </p>

      {state && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginTop: 24, maxWidth: 300,
        }}>
          {state.board.map((cell, i) => (
            <button
              key={i}
              disabled={!isMyTurn || cell !== null}
              onClick={() => send({ type: 'place_mark', cell: i })}
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

      {state && (
        <p style={{ color: '#666', fontSize: 14, marginTop: 16 }}>
          You: <strong>{myMark ?? '…'}</strong>
          {' | '}room: {room?.id ?? '…'}
          {' | '}phase: {state.phase}
          {state.phase === 'active' && ` | turn: ${state.currentPlayer}`}
        </p>
      )}

      {state?.phase === 'active' && (
        <button
          onClick={() => send({ type: 'resign' })}
          style={{ marginTop: 16, color: '#c0392b', background: 'none', border: '1px solid #c0392b', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
        >
          Resign
        </button>
      )}
    </main>
  );
}
