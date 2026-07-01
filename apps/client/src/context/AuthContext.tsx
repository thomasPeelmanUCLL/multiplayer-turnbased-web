/**
 * Auth context — single source of truth for the logged-in user.
 *
 * Wrap the app with <AuthProvider> once in main.tsx.
 * All components call useAuth() to read/mutate auth state.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface AuthState {
  userId: string | null;
  username: string | null;
  accessToken: string | null;
}

export interface AuthContextValue extends AuthState {
  login:    (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout:   () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    userId:      null,
    username:    null,
    accessToken: null,
  });

  async function login(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? 'Login failed');
    }

    const data = await res.json() as { userId: string; username: string; accessToken: string };
    setAuth({ userId: data.userId, username: data.username, accessToken: data.accessToken });
  }

  async function register(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: string; fields?: Record<string, string[]> };
      // Surface the first field-level error if present, else the top-level error
      const fieldErrors = body.fields ? Object.values(body.fields).flat().join(' ') : null;
      throw new Error(fieldErrors ?? body.error ?? 'Registration failed');
    }

    await login(username, password);
  }

  function logout() {
    setAuth({ userId: null, username: null, accessToken: null });
    fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ ...auth, isLoggedIn: auth.accessToken !== null, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
