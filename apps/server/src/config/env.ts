/**
 * Validates and exports all environment variables.
 *
 * The server will refuse to start if any required variable is missing
 * or malformed. This prevents silent misconfiguration in production.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL:              z.string().url(),
  REDIS_URL:                 z.string().url(),
  JWT_ACCESS_SECRET:         z.string().min(32),
  JWT_REFRESH_SECRET:        z.string().min(32),
  JWT_ACCESS_EXPIRES_IN:     z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS:  z.coerce.number().int().positive().default(7),
  PORT:                      z.coerce.number().int().positive().default(2567),
  FRONTEND_ORIGIN:           z.string().url(),
  NODE_ENV:                  z.enum(['development', 'production', 'test']).default('development'),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('[config] Invalid environment variables:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = result.data;
