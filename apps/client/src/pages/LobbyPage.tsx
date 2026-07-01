/**
 * Lobby page — list open matches and create new ones.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Match } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

export function LobbyPage() {
  const navigate                          = useNavigate();
  const { userId, username, accessToken, logout } = useAuth();

  const [matches,  setMatches]  = useState<Match[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    api.matches.list(accessToken)
      .then(setMatches)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load matches'));
  }, [accessToken]);

  async function createMatch() {
    if (!accessToken) return;
    setCreating(true);
    try {
      const match = await api.matches.create('tictactoe', accessToken);
      navigate(`/match/${match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Lobby</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#666' }}>{username ?? userId}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <button
        onClick={createMatch}
        disabled={creating}
        style={{ marginTop: 24, padding: '8px 16px' }}
      >
        {creating ? 'Creating…' : 'New game'}
      </button>

      {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Open matches</h2>
        {matches.length === 0 ? (
          <p style={{ color: '#666', marginTop: 8 }}>No open matches. Start one above.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
            {matches.map((m) => (
              <li
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <span>{m.gameType} — {m.status}</span>
                <button onClick={() => navigate(`/match/${m.id}`)}>Join</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
