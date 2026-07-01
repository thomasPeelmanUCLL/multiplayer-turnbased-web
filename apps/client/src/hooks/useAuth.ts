// Thin auth hook — stores the access token in memory (not localStorage).
// Exposes login, register, logout, userId, and username.

import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface AuthState {
  userId: string | null;
  username: string | null;
  accessToken: string | null;
}

export interface UseAuthReturn extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoggedIn: boolean;
}

export function useAuth(): UseAuthReturn {
  const [auth, setAuth] = useState<AuthState>({
    userId: null,
    username: null,
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
      const body = await res.json() as { error?: string };
      throw new Error(body.error ?? 'Registration failed');
    }

    await login(username, password);
  }

  function logout() {
    setAuth({ userId: null, username: null, accessToken: null });
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
  }

  return {
    ...auth,
    isLoggedIn: auth.accessToken !== null,
    login,
    register,
    logout,
  };
}
