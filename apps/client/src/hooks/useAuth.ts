// Thin auth hook — stores the access token in memory (not localStorage).
// Exposes login, register, logout, and the current userId.

import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

interface AuthState {
  userId: string | null;
  accessToken: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoggedIn: boolean;
}

export function useAuth(): UseAuthReturn {
  const [auth, setAuth] = useState<AuthState>({
    userId: null,
    accessToken: null,
  });

  async function login(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // receive the refresh token cookie
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Login failed");
    }

    const { userId, accessToken } = await res.json();
    setAuth({ userId, accessToken });
  }

  async function register(username: string, password: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Registration failed");
    }

    // Auto-login after successful registration
    await login(username, password);
  }

  function logout() {
    setAuth({ userId: null, accessToken: null });
    // Fire-and-forget the server-side revocation
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // Swallow — local state is already cleared
    });
  }

  return {
    ...auth,
    isLoggedIn: auth.accessToken !== null,
    login,
    register,
    logout,
  };
}
