/**
 * Root router.
 *
 * Routes:
 *   /            → redirect to /lobby if logged in, else /login
 *   /login       → LoginPage
 *   /register    → RegisterPage
 *   /lobby       → LobbyPage  (requires auth)
 *   /match/:id   → MatchPage  (requires auth)
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { LoginPage }    from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { LobbyPage }    from './pages/LobbyPage.js';
import { MatchPage }    from './pages/MatchPage.js';

export function App() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/lobby"
        element={isLoggedIn ? <LobbyPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/match/:matchId"
        element={isLoggedIn ? <MatchPage /> : <Navigate to="/login" replace />}
      />

      {/* Default redirect */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? '/lobby' : '/login'} replace />}
      />
    </Routes>
  );
}
