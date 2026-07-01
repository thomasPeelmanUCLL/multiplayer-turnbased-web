// Drizzle ORM schema — single source of truth for all table definitions.
// Run `pnpm db:generate` to create migrations from changes here.

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: text("id").primaryKey(), // Colyseus roomId
  playerX: uuid("player_x")
    .notNull()
    .references(() => users.id),
  playerO: uuid("player_o")
    .notNull()
    .references(() => users.id),
  /** null = match abandoned before finishing */
  winner: text("winner"), // "X" | "O" | "draw" | null
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
