/**
 * useAuth — in-memory auth state hook.
 *
 * Tokens are stored in module-level variables (not localStorage) because
 * the app may run in sandboxed iframes where storage access is blocked.
 *
 * Access tokens live for ~15 minutes and are silently refreshed when they
 * expire. Refresh tokens are opaque strings sent to /auth/refresh.
 */
import { useState, useCallback } from 'react';

type AuthState = {
  accessToken:  string | null;
  refreshToken: string | null;
  userId:       string | null;
  username:     string | null;
};

// Module-level storage — survives re-renders without triggering them
let _tokens: AuthState = {
  accessToken:  null,
  refreshToken: null,
  userId:       null,
  username:     null,
};

export function useAuth() {
  const [, rerender] = useState(0);

  const setAuth = useCallback((state: AuthState) => {
    _tokens = state;
    rerender((n) => n + 1);
  }, []);

  const login = useCallback(
    (accessToken: string, refreshToken: string, userId: string, username: string) => {
      setAuth({ accessToken, refreshToken, userId, username });
    },
    [setAuth],
  );

  const logout = useCallback(() => {
    setAuth({ accessToken: null, refreshToken: null, userId: null, username: null });
  }, [setAuth]);

  return {
    isLoggedIn:   !!_tokens.accessToken,
    accessToken:  _tokens.accessToken,
    refreshToken: _tokens.refreshToken,
    userId:       _tokens.userId,
    username:     _tokens.username,
    login,
    logout,
  };
}

/** Read the current access token without triggering a React render */
export function getAccessToken(): string | null {
  return _tokens.accessToken;
}
