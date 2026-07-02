import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = (import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567') + '/game';

// ---------------------------------------------------------------------------
// Types (mirror protocol.ts on the server)
// ---------------------------------------------------------------------------

type Cell = 'X' | 'O' | null;
type MatchPhase = 'waiting' | 'active' | 'finished';
type Player = 'X' | 'O';

export interface MatchState {
  roomId:        string;
  sessionId:     string;
  board:         Cell[];
  phase:         MatchPhase;
  currentPlayer: Player;
  winner:        Player | 'draw' | null;
  playerX:       string | null;
  playerO:       string | null;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface UseMatchReturn {
  state:   MatchState | null;
  status:  ConnectionStatus;
  logs:    string[];
  placeMark: (cell: number) => void;
  resign:    () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMatch(roomId: string | undefined): UseMatchReturn {
  const wsRef    = useRef<WebSocket | null>(null);
  const [state,  setState]  = useState<MatchState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [logs,   setLogs]   = useState<string[]>([]);

  function log(msg: string) {
    console.log('[useMatch]', msg);
    setLogs(prev => [...prev.slice(-29), msg]);
  }

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      log('connected');
      // Send join immediately
      const payload = roomId && roomId !== 'new' ? { roomId } : {};
      ws.send(JSON.stringify({ type: 'join', payload }));
      log(`sent join roomId=${roomId ?? '(any)'}`);
    };

    ws.onmessage = (ev) => {
      let msg: { type: string; payload: unknown };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        log('invalid JSON from server');
        return;
      }

      if (msg.type === 'state') {
        const s = msg.payload as MatchState;
        log(`phase=${s.phase} turn=${s.currentPlayer} board=${JSON.stringify(s.board)}`);
        setState(s);
      } else if (msg.type === 'error') {
        const e = msg.payload as { message: string };
        log(`server error: ${e.message}`);
      } else {
        log(`unknown msg type: ${msg.type}`);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      log('WebSocket error');
    };

    ws.onclose = (ev) => {
      setStatus('closed');
      log(`closed code=${ev.code}`);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const placeMark = useCallback((cell: number) => {
    log(`sending place_mark cell=${cell}`);
    send({ type: 'action', payload: { type: 'place_mark', cell } });
  }, [send]);

  const resign = useCallback(() => {
    log('sending resign');
    send({ type: 'action', payload: { type: 'resign' } });
  }, [send]);

  return { state, status, logs, placeMark, resign };
}
