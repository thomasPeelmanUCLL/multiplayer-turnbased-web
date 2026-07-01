/**
 * Drizzle ORM client.
 *
 * A single shared instance used by all server modules.
 * Never create additional Pool/Client instances — import `db` from here.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });
