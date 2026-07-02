import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';
import { TicTacToeSchema } from '../schema/TicTacToeSchema.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

function snapshot(state: TicTacToeSchema) {
  const board: string[] = [];
  for (let i = 0; i < 9; i++) board.push(state.board[i] ?? '');
  return {
    board,
    phase:         state.phase         ?? 'waiting',
    currentPlayer: state.currentPlayer ?? 'X',
    winner:        state.winner        ?? '',
    players: {
      X: state.players?.X ?? '',
      O: state.players?.O ?? '',
    },
  };
}

type MatchState = ReturnType<typeof snapshot>;

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const roomRef   = useRef<Room<TicTacToeSchema> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  const [state,     setState]     = useState<MatchState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [debugLog,  setDebugLog]  = useState<string[]>([]);

  function log(msg: string) {
    console.log('[MatchPage]', msg);
    setDebugLog(prev => [...prev.slice(-19), msg]);
  }

  useEffect(() => {
    const client = new ColyseusClient(WS_URL);
    let cancelled = false;

    log(`connecting to ${WS_URL}, matchId=${matchId}`);

    function startPolling(room: Room<TicTacToeSchema>) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        pollCount.current += 1;
        const s = room.state;
        const snap = snapshot(s);

        if (pollCount.current % 5 === 1) {
          log(`poll#${pollCount.current} phase=${s?.phase} X=${s?.players?.X?.slice(0,6)} O=${s?.players?.O?.slice(0,6)}`);
        }

        setState(snap);

        if (snap.phase === 'finished') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          log('poll stopped — game finished');
        }
      }, 100);
    }

    function attachHandlers(room: Room<TicTacToeSchema>) {
      if (cancelled) { room.leave(); return; }
      roomRef.current = room;
      setSessionId(room.sessionId);

      log(`joined room=${room.roomId} sessionId=${room.sessionId}`);
      log(`initial state: phase=${room.state?.phase} X=${room.state?.players?.X} O=${room.state?.players?.O}`);

      if (matchId === 'new') navigate(`/match/${room.roomId}`, { replace: true });

      room.onStateChange((s) => {
        log(`onStateChange: phase=${s.phase} X=${s.players?.X?.slice(0,6)} O=${s.players?.O?.slice(0,6)}`);
        setState(snapshot(s));
      });
      room.onError((code, msg) => { log(`ERROR ${code}: ${msg}`); setError(`${code}: ${msg}`); });
      room.onLeave((code) => { log(`onLeave code=${code}`); roomRef.current = null; });

      startPolling(room);
    }

    const promise = matchId === 'new'
      ? client.joinOrCreate<TicTacToeSchema>('tictactoe', {}, TicTacToeSchema)
      : client.joinById<TicTacToeSchema>(matchId!, {}, TicTacToeSchema);

    promise.then(attachHandlers).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      log(`join FAILED: ${msg}`);
      setError(msg);
    });

    return () => {
      cancelled = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      roomRef.current?.leave();
      roomRef.current = null;
    };
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
      <DebugPanel log={debugLog} />
    </main>
  );

  const myMark = sessionId === state.players.X ? 'X'
               : sessionId === state.players.O ? 'O'
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
        {' | '}phase: {state.phase}
        {' | '}X={state.players.X.slice(0,6)} O={state.players.O.slice(0,6)}
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
      maxHeight: 220, overflowY: 'auto',
    }}>
      {log.length === 0
        ? <span style={{ color: '#666' }}>no logs yet</span>
        : log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
