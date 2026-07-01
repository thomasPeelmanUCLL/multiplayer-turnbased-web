/**
 * Lobby page.
 *
 * Shows a list of open matches and a button to create a new one.
 * Polling every 5 seconds keeps the list reasonably fresh.
 * (WebSocket-based live updates are a MVP 2 improvement.)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Match } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const POLL_INTERVAL_MS = 5_000;

export function LobbyPage() {
  const navigate         = useNavigate();
  const { username, logout } = useAuth();

  const [matches,  setMatches]  = useState<Match[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      const data = await api.matches.list();
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    void fetchMatches();
    const interval = setInterval(fetchMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  async function createMatch() {
    setCreating(true);
    try {
      const match = await api.matches.create('tictactoe');
      navigate(`/match/${match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Lobby</h1>
        <span>
          {username} &nbsp;
          <button onClick={logout}>Log out</button>
        </span>
      </header>

      <button
        onClick={createMatch}
        disabled={creating}
        style={{ marginTop: 24 }}
      >
        {creating ? 'Creating…' : '+ New tic-tac-toe match'}
      </button>

      {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Open matches</h2>
        {matches.length === 0 ? (
          <p style={{ marginTop: 12, color: '#666' }}>No open matches yet. Create one!</p>
        ) : (
          <ul style={{ listStyle: 'none', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matches.map((match) => (
              <li key={match.id}>
                <button onClick={() => navigate(`/match/${match.id}`)}
                  style={{ width: '100%', textAlign: 'left' }}>
                  Match {match.id.slice(0, 8)}… — {match.gameType} — {new Date(match.createdAt).toLocaleTimeString()}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
