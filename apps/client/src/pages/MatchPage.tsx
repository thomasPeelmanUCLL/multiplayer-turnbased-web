import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client as ColyseusClient, type Room } from 'colyseus.js';

const WS_URL = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567';

interface MatchState {
  board: string[];
  phase: string;
  currentPlayer: string;
  winner: string;
  players: { X: string; O: string };
}

function snapshot(room: Room<MatchState>): MatchState {
  const s = room.state as any;
  const board: string[] = [];
  for (let i = 0; i < 9; i++) board.push(s.board?.[i] == null ? '' : String(s.board[i]));
  const result = {
    board,
    phase:         String(s.phase         ?? 'waiting'),
    currentPlayer: String(s.currentPlayer ?? 'X'),
    winner:        String(s.winner        ?? ''),
    players: {
      X: String(s.players?.X ?? ''),
      O: String(s.players?.O ?? ''),
    },
  };
  return result;
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const roomRef    = useRef<Room<MatchState> | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount  = useRef(0);

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

    function startPolling(room: Room<MatchState>) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        pollCount.current += 1;
        const s = room.state as any;
        const snap = snapshot(room);

        // Log raw state every 5 ticks so we can see what Colyseus actually has
        if (pollCount.current % 5 === 1) {
          log(`poll#${pollCount.current} raw: phase=${s?.phase} players.X=${s?.players?.X} players.O=${s?.players?.O}`);
          log(`poll#${pollCount.current} snap: phase=${snap.phase} X=${snap.players.X} O=${snap.players.O} me=${room.sessionId}`);
        }

        setState(snap);

        if (snap.phase === 'finished') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          log('poll stopped — game finished');
        }
      }, 100);
    }

    function attachHandlers(room: Room<MatchState>) {
      if (cancelled) { room.leave(); return; }
      roomRef.current = room;
      setSessionId(room.sessionId);
      log(`joined room=${room.roomId} sessionId=${room.sessionId}`);

      // Log raw state immediately after join
      const s = room.state as any;
      log(`state immediately after join: phase=${s?.phase} players.X=${s?.players?.X} players.O=${s?.players?.O}`);

      if (matchId === 'new') navigate(`/match/${room.roomId}`, { replace: true });

      room.onStateChange((newState: any) => {
        log(`onStateChange fired: phase=${newState?.phase} players.X=${newState?.players?.X} players.O=${newState?.players?.O}`);
        setState(snapshot(room));
      });
      room.onError((code, msg) => {
        log(`ERROR code=${code} msg=${msg}`);
        setError(`Room error ${code}: ${msg}`);
      });
      room.onLeave((code) => {
        log(`onLeave code=${code}`);
        roomRef.current = null;
      });

      startPolling(room);
    }

    const promise = matchId === 'new'
      ? client.joinOrCreate<MatchState>('tictactoe')
      : client.joinById<MatchState>(matchId!);

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
    log(`placing mark at cell ${i}`);
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
      {log.length === 0 ? <span style={{color:'#666'}}>no logs yet</span>
        : log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
