/**
 * Lobby page — create or join a Colyseus tictactoe room.
 *
 * After joining, the live Room object is passed via router state so
 * MatchPage can reuse the existing connection instead of re-joining.
 * The room is NOT left on unmount when we're navigating to the match.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'colyseus.js';
import { useAuth } from '../hooks/useAuth.js';
import type { TicTacToeState } from '@repo/shared';

const colyseusClient = new Client(
  import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567',
);

export function LobbyPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // When we navigate to the match we hand off the room — don't leave it
  const handedOffRef = useRef(false);

  async function handleFindMatch() {
    setError(null);
    setLoading(true);
    handedOffRef.current = false;
    try {
      const room = await colyseusClient.joinOrCreate<TicTacToeState>('tictactoe');
      handedOffRef.current = true;
      navigate(`/match/${room.roomId}`, { state: { room } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to server');
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 32,
      }}>
        <h1 style={{ margin: 0 }}>Lobby</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#666' }}>{username}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <button
        onClick={handleFindMatch}
        disabled={loading}
        style={{ padding: '10px 24px', fontSize: 16 }}
      >
        {loading ? 'Finding match…' : 'Find match'}
      </button>

      {error && <p style={{ color: 'red', marginTop: 16 }}>{error}</p>}
    </main>
  );
}
