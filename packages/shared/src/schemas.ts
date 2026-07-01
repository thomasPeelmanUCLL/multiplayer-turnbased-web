// Zod validation schemas shared between client and server.
import { z } from "zod";

export const RegisterBodySchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

export const LoginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().uuid(),
});

export const CreateMatchBodySchema = z.object({
  gameType: z.literal("tictactoe").default("tictactoe"),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody    = z.infer<typeof LoginBodySchema>;
export type RefreshBody  = z.infer<typeof RefreshBodySchema>;
export type CreateMatchBody = z.infer<typeof CreateMatchBodySchema>;
