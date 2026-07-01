/**
 * Lobby page — create or join a Colyseus tictactoe room.
 *
 * Room creation goes directly through colyseus.js (not the REST API)
 * so the Colyseus server is the authoritative source of room IDs.
 * The REST /matches list still shows DB-persisted finished matches.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from 'colyseus.js';
import { useAuth } from '../hooks/useAuth.js';

const colyseusClient = new Client(import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:2567');

export function LobbyPage() {
  const navigate = useNavigate();
  const { username, accessToken, logout } = useAuth();

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFindMatch() {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      // Try to join an existing waiting room first; create one if none available.
      let room;
      try {
        room = await colyseusClient.joinOrCreate('tictactoe', { token: accessToken });
      } catch {
        room = await colyseusClient.create('tictactoe', { token: accessToken });
      }
      navigate(`/match/${room.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
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
