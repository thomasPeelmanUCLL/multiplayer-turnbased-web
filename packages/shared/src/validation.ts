import { z } from 'zod';

// ---------------------------------------------------------------------------
// TicTacToe action schemas
// These are the Zod runtime validators. The inferred types here are
// intentionally named with a 'Validated' prefix to avoid clashing with the
// plain TS union types in actions.ts.
// ---------------------------------------------------------------------------

export const PlaceMarkSchema = z.object({
  type: z.literal('place_mark'),
  cell: z.number().int().min(0).max(8),
});

export const ResignSchema = z.object({
  type: z.literal('resign'),
});

export const ClientActionSchema = z.discriminatedUnion('type', [
  PlaceMarkSchema,
  ResignSchema,
]);

/** Runtime-validated action — use this type inside rooms after .safeParse() */
export type ValidatedClientAction = z.infer<typeof ClientActionSchema>;
