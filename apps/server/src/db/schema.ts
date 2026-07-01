/**
 * Drizzle table definitions.
 *
 * These are the single source of truth for the database structure.
 * Run `drizzle-kit generate` to produce SQL migrations from this file.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  timestamp,
  bigserial,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  username:   text('username').notNull().unique(),
  email:      text('email').notNull().unique(),
  /** bcrypt hash — never the plaintext password */
  password:   text('password').notNull(),
  avatarUrl:  text('avatar_url'),
  elo:        integer('elo').notNull().default(1000),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Matches ───────────────────────────────────────────────────────────────────

export const matches = pgTable('matches', {
  id:          uuid('id').primaryKey().defaultRandom(),
  gameType:    text('game_type').notNull(),
  /** waiting | active | finished | abandoned */
  status:      text('status').notNull().default('waiting'),
  winnerId:    uuid('winner_id').references(() => users.id),
  startedAt:   timestamp('started_at', { withTimezone: true }),
  finishedAt:  timestamp('finished_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Match players ─────────────────────────────────────────────────────────────

export const matchPlayers = pgTable(
  'match_players',
  {
    id:       uuid('id').primaryKey().defaultRandom(),
    matchId:  uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    userId:   uuid('user_id').notNull().references(() => users.id),
    /** Turn order — 0 means this player goes first */
    seat:     smallint('seat').notNull(),
    /** win | loss | draw | abandoned */
    result:   text('result'),
  },
  (t) => ({
    uniqueSeat: unique().on(t.matchId, t.seat),
  }),
);

// ── Turn events (event log) ───────────────────────────────────────────────────

export const turnEvents = pgTable('turn_events', {
  id:          bigserial('id', { mode: 'number' }).primaryKey(),
  matchId:     uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  turnNumber:  integer('turn_number').notNull(),
  playerId:    uuid('player_id').notNull().references(() => users.id),
  /** place | end_turn | surrender */
  actionType:  text('action_type').notNull(),
  payload:     jsonb('payload').notNull().default({}),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Refresh tokens ────────────────────────────────────────────────────────────

export const refreshTokens = pgTable('refresh_tokens', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Opaque random token stored here; hashed form goes in the cookie/body */
  token:      text('token').notNull().unique(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
