/**
 * Typed API client for all HTTP endpoints.
 *
 * Accepts an optional accessToken for authenticated requests.
 * Every function throws an Error with a human-readable message on failure.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : null,
    credentials: 'include',
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

export const api = {
  matches: {
    list: (token: string) =>
      request<Match[]>('GET', '/matches', undefined, token),

    create: (gameType: 'tictactoe', token: string) =>
      request<Match>('POST', '/matches', { gameType }, token),

    get: (id: string, token: string) =>
      request<Match>('GET', `/matches/${id}`, undefined, token),
  },

  users: {
    me: (token: string) =>
      request<User>('GET', '/users/me', undefined, token),
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
