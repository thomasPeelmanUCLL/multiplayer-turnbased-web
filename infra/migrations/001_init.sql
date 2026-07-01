-- Migration 001 — initial schema
-- Apply with:
--   docker compose -f infra/docker-compose.yml exec -T postgres psql -U dev -d turnbased -f /migrations/001_init.sql
-- Or mount this directory into the postgres container and use the
-- official postgres docker entrypoint (docker-entrypoint-initdb.d).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT        PRIMARY KEY,           -- Colyseus roomId
  player_x    UUID        NOT NULL REFERENCES users(id),
  player_o    UUID        NOT NULL REFERENCES users(id),
  winner      TEXT,                              -- 'X' | 'O' | 'draw' | NULL
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
