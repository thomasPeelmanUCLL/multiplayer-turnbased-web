/**
 * Zod schemas for runtime validation of client messages.
 *
 * Used on the server inside every Colyseus onMessage handler
 * and on every Express request body handler.
 */
import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const RegisterBodySchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Match HTTP ────────────────────────────────────────────────────────────────

export const CreateMatchBodySchema = z.object({
  gameType: z.literal('tictactoe'),
});

// ── WebSocket actions ─────────────────────────────────────────────────────────

export const PlaceActionSchema = z.object({
  type: z.literal('place'),
  position: z.number().int().min(0).max(8),
});

export const EndTurnActionSchema = z.object({
  type: z.literal('end_turn'),
});

export const SurrenderActionSchema = z.object({
  type: z.literal('surrender'),
});

/**
 * Validates any incoming client action.
 * Use this as the first step in every onMessage handler.
 */
export const ClientActionSchema = z.discriminatedUnion('type', [
  PlaceActionSchema,
  EndTurnActionSchema,
  SurrenderActionSchema,
]);

// ── Inferred types (kept in sync automatically) ───────────────────────────────

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody    = z.infer<typeof LoginBodySchema>;
export type RefreshBody  = z.infer<typeof RefreshBodySchema>;
export type CreateMatchBody = z.infer<typeof CreateMatchBodySchema>;
