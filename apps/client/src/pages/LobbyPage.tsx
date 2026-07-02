import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function LobbyPage() {
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  function handleFindMatch() {
    setLoading(true);
    // MatchPage owns all Colyseus logic; we just route there.
    // A unique ID in the URL lets MatchPage call joinOrCreate with a
    // predictable room name so two players land in the same room.
    navigate('/match/new');
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
        {loading ? 'Connecting…' : 'Find match'}
      </button>
    </main>
  );
}
