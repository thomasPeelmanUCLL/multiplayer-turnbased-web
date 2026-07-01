/**
 * Typed API client for all HTTP endpoints.
 *
 * Every function throws an Error with a human-readable message on failure.
 * The caller (a React component or hook) decides how to handle it.
 */
import { getAccessToken } from '../hooks/useAuth.js';

const BASE = '';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  username: string;
};

export const api = {
  auth: {
    register: (username: string, email: string, password: string) =>
      request<AuthResponse>('POST', '/auth/register', { username, email, password }),

    login: (email: string, password: string) =>
      request<AuthResponse>('POST', '/auth/login', { email, password }),

    refresh: (refreshToken: string) =>
      request<Omit<AuthResponse, 'username'>>('POST', '/auth/refresh', { refreshToken }),

    logout: (refreshToken: string) =>
      request<{ ok: boolean }>('POST', '/auth/logout', { refreshToken }, true),
  },

  matches: {
    list: () =>
      request<Match[]>('GET', '/matches', undefined, true),

    create: (gameType: 'tictactoe') =>
      request<Match>('POST', '/matches', { gameType }, true),

    get: (id: string) =>
      request<Match>('GET', `/matches/${id}`, undefined, true),
  },

  users: {
    me: () =>
      request<User>('GET', '/users/me', undefined, true),
  },
};

// ── Response shapes ───────────────────────────────────────────────────────────

export type Match = {
  id: string;
  gameType: string;
  status: string;
  winnerId: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  username: string;
  avatarUrl: string | null;
  elo: number;
  createdAt: string;
};
