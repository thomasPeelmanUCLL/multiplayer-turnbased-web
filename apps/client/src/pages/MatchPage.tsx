import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

interface MatchState {
  board: (string | null)[];
  phase: string;
  currentPlayer: string;
  winner: string | null;
  playerX: string | null;
  playerO: string | null;
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const roomRef = useRef<Room | null>(null);

  const [state,     setState]     = useState<MatchState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [debugLog,  setDebugLog]  = useState<string[]>([]);

  function log(msg: string) {
    console.log('[MatchPage]', msg);
    setDebugLog(prev => [...prev.slice(-24), msg]);
  }

  useEffect(() => {
    const client = new ColyseusClient(WS_URL);
    let cancelled = false;

    function attachHandlers(room: Room) {
      if (cancelled) { room.leave(); return; }
      roomRef.current = room;
      setSessionId(room.sessionId);
      log(`joined room=${room.roomId} me=${room.sessionId}`);

      if (matchId === 'new') navigate(`/match/${room.roomId}`, { replace: true });

      room.onMessage('state', (msg: MatchState) => {
        log(`phase=${msg.phase} turn=${msg.currentPlayer} X=${msg.playerX?.slice(0,6)} O=${msg.playerO?.slice(0,6)}`);
        log(`board=${JSON.stringify(msg.board)}`);
        setState(msg);
      });

      room.onMessage('error', (msg: { message: string }) => {
        log(`server error: ${msg.message}`);
      });

      room.onError((code, msg) => { log(`ERROR ${code}: ${msg}`); setError(`${code}: ${msg}`); });
      room.onLeave((code) => { log(`onLeave code=${code}`); roomRef.current = null; });
    }

    const promise = matchId === 'new'
      ? client.joinOrCreate('tictactoe')
      : client.joinById(matchId!);

    promise.then(attachHandlers).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      log(`join FAILED: ${msg}`);
      setError(msg);
    });

    return () => {
      cancelled = true;
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function place(i: number) {
    log(`sending place_mark cell=${i}`);
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
      <DebugPanel log={debugLog} />
    </main>
  );

  const myMark = sessionId === state.playerX ? 'X'
               : sessionId === state.playerO ? 'O'
               : null;

  const isMyTurn =
    state.phase === 'active' && myMark !== null && state.currentPlayer === myMark;

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Tic-Tac-Toe</h1>
        <button onClick={() => navigate('/lobby')}>← Lobby</button>
      </header>

      <p style={{ marginTop: 16, fontSize: 18 }}>
        {state.phase === 'waiting'  && '⏳ Waiting for opponent…'}
        {state.phase === 'active'   && (isMyTurn ? '🟢 Your turn' : "⏳ Opponent's turn")}
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
        {state.board.map((cell, i) => {
          const filled = cell !== null && cell !== '';
          return (
            <button
              key={i}
              disabled={!isMyTurn || filled}
              onClick={() => place(i)}
              style={{
                height: 90, fontSize: 40, fontWeight: 'bold',
                background: '#fff', border: '2px solid #ccc', borderRadius: 8,
                cursor: isMyTurn && !filled ? 'pointer' : 'default',
                color: cell === 'X' ? '#e74c3c' : '#3498db',
              }}
            >
              {cell ?? ''}
            </button>
          );
        })}
      </div>

      <p style={{ color: '#666', fontSize: 14, marginTop: 20 }}>
        You are playing as <strong>{myMark ?? '…'}</strong>
        {' | '}phase: {state.phase}
        {' | '}turn: {state.currentPlayer}
        {' | '}me={sessionId.slice(0,6)}
      </p>

      <DebugPanel log={debugLog} />
    </main>
  );
}

function DebugPanel({ log }: { log: string[] }) {
  return (
    <div style={{
      marginTop: 24, padding: 12, background: '#1a1a1a', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11, borderRadius: 6,
      maxHeight: 260, overflowY: 'auto',
    }}>
      {log.length === 0
        ? <span style={{ color: '#666' }}>no logs yet</span>
        : log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
