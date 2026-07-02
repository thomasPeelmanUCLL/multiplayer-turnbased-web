import { z } from 'zod';

export const PlaceMarkSchema = z.object({
  type: z.literal('place_mark'),
  cell: z.number().int().min(0).max(8),
});

export const ResignSchema = z.object({
  type: z.literal('resign'),
});

/**
 * All valid actions a client can send to a TicTacToe room.
 * Use .safeParse() to validate before passing to game logic.
 */
export const ClientActionSchema = z.discriminatedUnion('type', [
  PlaceMarkSchema,
  ResignSchema,
]);

export type ClientActionInput = z.infer<typeof ClientActionSchema>;
